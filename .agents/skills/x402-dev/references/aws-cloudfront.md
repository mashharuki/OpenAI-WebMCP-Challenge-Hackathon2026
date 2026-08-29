# x402 with AWS CloudFront + Lambda@Edge

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [CDK Stack: Seller Infrastructure](#cdk-stack-seller-infrastructure)
3. [Lambda@Edge Payment Verifier](#lambdaedge-payment-verifier)
4. [CDK Stack: Payer Infrastructure (AgentCore)](#cdk-stack-payer-infrastructure-agentcore)
5. [Python Payer Agent (Strands SDK)](#python-payer-agent-strands-sdk)
6. [3-Step Payment Flow Pattern](#3-step-payment-flow-pattern)
7. [Key Constraints & Solutions](#key-constraints--solutions)

---

## Architecture Overview

```
AI Agent (Bedrock AgentCore)
  │
  ├─→ /mcp/tools (free, returns tool list with prices)
  │
  └─→ /api/premium-content
        └─→ CloudFront
              └─→ Lambda@Edge (payment-verifier)
                    ├─ No payment header → 402 + payment requirements
                    ├─ With payment → verify via x402.org facilitator
                    │                 settle on Base Sepolia
                    └─ Verified → return content from S3
```

**3 CDK stacks:**
- `seller-infrastructure` — CloudFront + Lambda@Edge + S3 content
- `payer-infrastructure` — AgentCore Runtime + Gateway + IAM + Secrets Manager
- `web-ui-infrastructure` — React UI + API Gateway proxy

---

## CDK Stack: Seller Infrastructure

```typescript
// seller-infrastructure/lib/cloudfront-stack.ts
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";

export class SellerStack extends cdk.Stack {
  public readonly distributionUrl: string;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      // Lambda@Edge MUST be deployed in us-east-1
      env: { region: "us-east-1" },
    });

    // S3 bucket for content
    const contentBucket = new s3.Bucket(this, "ContentBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda@Edge function for payment verification
    // IMPORTANT: Lambda@Edge does NOT support environment variables
    // Bundle config as deploy-config.json instead
    const paymentVerifier = new cloudfront.experimental.EdgeFunction(
      this, "PaymentVerifier", {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "payment-verifier.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "lambda-edge"),
          {
            bundling: {
              // Bundle deploy-config.json with the Lambda code
              command: [
                "bash", "-c",
                "cp -r . /asset-output && node build.js"
              ],
            },
          }
        ),
        memorySize: 128,
        timeout: cdk.Duration.seconds(20), // Lambda@Edge max: 30s for viewer-response
      }
    );

    // Cache policy — DISABLE caching for payment-protected routes
    const noCachePolicy = new cloudfront.CachePolicy(this, "NoCachePolicy", {
      defaultTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Forward payment headers to origin
    const paymentOriginPolicy = new cloudfront.OriginRequestPolicy(
      this, "PaymentOriginPolicy", {
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          "X-Payment-Signature",
          "Payment-Signature",
          "Content-Type",
          "Accept",
        ),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      }
    );

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(contentBucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // Payment-protected API routes
        "/api/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(contentBucket),
          cachePolicy: noCachePolicy,
          originRequestPolicy: paymentOriginPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          edgeLambdas: [{
            functionVersion: paymentVerifier.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          }],
        },
        // Free MCP discovery endpoint
        "/mcp/tools": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(contentBucket),
          cachePolicy: noCachePolicy,
          edgeLambdas: [{
            functionVersion: paymentVerifier.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          }],
        },
      },
    });

    // Deploy content to S3
    new s3deploy.BucketDeployment(this, "DeployContent", {
      sources: [s3deploy.Source.asset("./content")],
      destinationBucket: contentBucket,
    });

    this.distributionUrl = `https://${distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, "DistributionUrl", { value: this.distributionUrl });
  }
}
```

---

## Lambda@Edge Payment Verifier

```typescript
// seller-infrastructure/lib/lambda-edge/payment-verifier.ts
import {
  CloudFrontRequestEvent,
  CloudFrontRequestResult,
  CloudFrontRequest,
} from "aws-lambda";

// Lambda@Edge can't use environment variables — load config from bundled file
import * as deployConfig from "./deploy-config.json";

interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;      // atomic units (e.g., "1000" = 0.001 USDC)
  asset: string;       // USDC contract address
  payTo: string;       // recipient wallet
  maxTimeoutSeconds: number;
}

interface ContentItem {
  description: string;
  pricing: PaymentRequirement;
}

// Content catalog with payment requirements
const CONTENT_CATALOG: Record<string, ContentItem> = {
  "/api/premium-article": {
    description: "Premium industry analysis article",
    pricing: {
      scheme: "exact",
      network: "eip155:84532",
      amount: "1000",           // 0.001 USDC
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: deployConfig.PAYMENT_RECIPIENT_ADDRESS,
      maxTimeoutSeconds: 300,
    },
  },
  "/api/market-analysis": {
    description: "Real-time market analysis",
    pricing: {
      scheme: "exact",
      network: "eip155:84532",
      amount: "2000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: deployConfig.PAYMENT_RECIPIENT_ADDRESS,
      maxTimeoutSeconds: 300,
    },
  },
};

const FACILITATOR_URL = "https://x402.org/facilitator";

export const handler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;

  // Free endpoint: MCP tool discovery
  if (uri === "/mcp/tools") {
    return createMCPDiscoveryResponse();
  }

  // Check if this path requires payment
  const contentItem = CONTENT_CATALOG[uri];
  if (!contentItem) {
    return request; // Free path — pass through to S3
  }

  // Check for payment signature header
  const paymentHeader =
    request.headers["x-payment-signature"]?.[0]?.value ||
    request.headers["payment-signature"]?.[0]?.value;

  if (!paymentHeader) {
    return create402Response(uri, contentItem);
  }

  // Decode and validate payment payload
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
  } catch {
    return createErrorResponse("400", "Bad Request", "Invalid payment header encoding");
  }

  // Validate payload structure
  if (!payload.x402Version || !payload.accepted || !payload.payload) {
    return create402Response(uri, contentItem, "Invalid payment payload structure");
  }

  // Validate payment parameters match requirements
  const accepted = payload.accepted;
  const req = contentItem.pricing;

  if (
    accepted.scheme !== req.scheme ||
    accepted.network !== req.network ||
    accepted.asset?.toLowerCase() !== req.asset.toLowerCase() ||
    accepted.payTo?.toLowerCase() !== req.payTo.toLowerCase() ||
    parseInt(accepted.amount) < parseInt(req.amount)
  ) {
    return create402Response(uri, contentItem, "Payment parameters do not match requirements");
  }

  // Verify signature with facilitator
  const verifyResponse = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, requirements: req }),
  });

  if (!verifyResponse.ok) {
    const error = await verifyResponse.json();
    return create402Response(uri, contentItem, `Signature verification failed: ${error.message}`);
  }

  // Settle payment on-chain
  const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, requirements: req }),
  });

  if (!settleResponse.ok) {
    return createErrorResponse("402", "Payment Required", "Settlement failed");
  }

  const settlement = await settleResponse.json();

  // Payment verified and settled — allow request through to S3
  // Attach settlement info as response header
  return {
    ...request,
    headers: {
      ...request.headers,
      "x-payment-response": [{
        key: "X-PAYMENT-RESPONSE",
        value: Buffer.from(JSON.stringify({
          success: true,
          txHash: settlement.txHash,
        })).toString("base64"),
      }],
    },
  };
};

function create402Response(
  uri: string,
  contentItem: ContentItem,
  errorMessage?: string
): CloudFrontRequestResult {
  const paymentRequired = {
    x402Version: 2,
    error: errorMessage ?? "Payment required to access this resource",
    resource: { url: uri, mimeType: "application/json" },
    accepts: [contentItem.pricing],
    extensions: {},
  };

  return {
    status: "402",
    statusDescription: "Payment Required",
    headers: {
      "content-type": [{ key: "Content-Type", value: "application/json" }],
      "x-payment-required": [{
        key: "X-PAYMENT-REQUIRED",
        value: Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
      }],
      "access-control-expose-headers": [{
        key: "Access-Control-Expose-Headers",
        value: "X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE",
      }],
      "access-control-allow-origin": [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
    body: JSON.stringify({ error: "Payment Required", x402Version: 2 }),
  };
}

function createMCPDiscoveryResponse(): CloudFrontRequestResult {
  const tools = Object.entries(CONTENT_CATALOG).map(([path, item]) => {
    const toolName = "get_" + path.replace("/api/", "").replace(/-/g, "_");
    const displayPrice = (parseInt(item.pricing.amount) / 1_000_000).toFixed(6);

    return {
      tool_name: toolName,
      tool_description: `${item.description}. Requires x402 payment.`,
      endpoint_path: path,
      x402_metadata: {
        price_usdc_units: item.pricing.amount,
        price_usdc_display: `${displayPrice} USDC`,
        network: item.pricing.network,
        scheme: item.pricing.scheme,
        asset_address: item.pricing.asset,
      },
      input_schema: { type: "object", properties: {}, required: [] },
    };
  });

  return {
    status: "200",
    headers: {
      "content-type": [{ key: "Content-Type", value: "application/json" }],
      "access-control-allow-origin": [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
    body: JSON.stringify({ version: "1.0", tools }),
  };
}

function createErrorResponse(
  status: string,
  statusDescription: string,
  message: string
): CloudFrontRequestResult {
  return {
    status,
    statusDescription,
    headers: {
      "content-type": [{ key: "Content-Type", value: "application/json" }],
    },
    body: JSON.stringify({ error: message }),
  };
}
```

---

## CDK Stack: Payer Infrastructure (AgentCore)

```typescript
// payer-infrastructure/lib/agentcore-stack.ts
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as path from "path";

export class PayerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: {
    sellerApiUrl: string;
  } & cdk.StackProps) {
    super(scope, id, props);

    // CDP credentials in Secrets Manager
    const cdpSecret = new secretsmanager.Secret(this, "CDPSecret", {
      secretName: "x402-payer/cdp-credentials",
      description: "Coinbase Developer Platform API credentials for x402 payments",
    });

    // IAM role for AgentCore Runtime
    const agentRuntimeRole = new iam.Role(this, "AgentRuntimeRole", {
      roleName: "x402-payer-agent-runtime-role",
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
    });

    // Grant Bedrock model access
    agentRuntimeRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ],
      resources: [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*",
      ],
    }));

    // Grant CDP secret access
    cdpSecret.grantRead(agentRuntimeRole);

    // Upload OpenAPI spec for MCP gateway
    const openApiSpec = new s3assets.Asset(this, "OpenApiSpec", {
      path: path.join(__dirname, "../../payer-agent/openapi/x402-tools.yaml"),
    });
    openApiSpec.grantRead(agentRuntimeRole);

    // AgentCore Runtime (using L1 construct until L2 is available)
    const agentRuntime = new cdk.CfnResource(this, "AgentRuntime", {
      type: "AWS::BedrockAgentCore::AgentRuntime",
      properties: {
        AgentRuntimeName: "x402-payer-agent",
        Description: "AI agent that autonomously pays for x402-protected content",
        AgentRuntimeArtifact: {
          ContainerConfiguration: {
            ContainerUri: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/x402-payer-agent:latest`,
          },
        },
        RoleArn: agentRuntimeRole.roleArn,
        EnvironmentVariables: {
          SELLER_API_URL: props!.sellerApiUrl,
          CDP_SECRET_ARN: cdpSecret.secretArn,
          OPENAPI_SPEC_S3_URI: `s3://${openApiSpec.s3BucketName}/${openApiSpec.s3ObjectKey}`,
        },
      },
    });

    new cdk.CfnOutput(this, "AgentRuntimeArn", {
      value: agentRuntime.getAtt("AgentRuntimeArn").toString(),
    });
  }
}
```

---

## Python Payer Agent (Strands SDK)

```python
# payer-agent/agent/main.py
import os
import json
import base64
import secrets
import time
from strands import Agent, tool
from strands.models import BedrockModel
import httpx
from cdp import CdpClient

# Initialize CDP wallet
cdp_client = CdpClient(
    api_key_id=os.environ["CDP_API_KEY_ID"],
    api_key_secret=os.environ["CDP_API_KEY_SECRET"],
)
wallet = cdp_client.wallets.load(os.environ["CDP_WALLET_SECRET"])
SELLER_API_URL = os.environ["SELLER_API_URL"]

@tool
def discover_services() -> dict:
    """Discover available x402-protected services and their prices."""
    with httpx.Client(timeout=30.0) as client:
        response = client.get(f"{SELLER_API_URL}/mcp/tools")
        return response.json()

@tool
def request_service(endpoint_path: str, payment_payload: dict = None) -> dict:
    """
    Request an x402-protected service.
    If no payment_payload provided, returns 402 with payment requirements.
    If payment_payload provided, includes it in X-Payment-Signature header.
    """
    url = f"{SELLER_API_URL}{endpoint_path}"
    headers = {"Accept": "application/json"}

    if payment_payload:
        headers["X-Payment-Signature"] = base64.b64encode(
            json.dumps(payment_payload).encode()
        ).decode()

    with httpx.Client(timeout=30.0) as client:
        response = client.get(url, headers=headers)

    if response.status_code == 200:
        return {
            "success": True,
            "data": response.json(),
            "payment_response": response.headers.get("x-payment-response"),
        }

    if response.status_code == 402:
        payment_required_b64 = response.headers.get("x-payment-required")
        payment_data = json.loads(base64.b64decode(payment_required_b64))
        req = payment_data["accepts"][0]
        return {
            "success": False,
            "http_status": 402,
            "payment_required": req,
        }

    return {
        "success": False,
        "http_status": response.status_code,
        "error": response.text,
    }

@tool
def sign_payment(
    scheme: str,
    network: str,
    amount: str,
    recipient: str,
    asset: str,
    max_timeout_seconds: int = 300,
) -> dict:
    """
    Create a signed x402 v2 payment payload using EIP-3009 TransferWithAuthorization.
    Returns a payload to be passed to request_service's payment_payload parameter.
    """
    chain_id = network.split(":")[1]
    address = wallet.get_address()

    now = int(time.time())
    valid_after = now - 60
    valid_before = now + max_timeout_seconds
    nonce = "0x" + secrets.token_bytes(32).hex()

    # EIP-712 typed data for TransferWithAuthorization
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ],
        },
        "primaryType": "TransferWithAuthorization",
        "domain": {
            "name": "USDC",
            "version": "2",
            "chainId": int(chain_id),
            "verifyingContract": asset,
        },
        "message": {
            "from": address,
            "to": recipient,
            "value": int(amount),
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce,
        },
    }

    signature = wallet.sign_typed_data(typed_data)

    return {
        "success": True,
        "payload": {
            "x402Version": 2,
            "accepted": {
                "scheme": scheme,
                "network": network,
                "amount": amount,
                "asset": asset,
                "payTo": recipient,
                "maxTimeoutSeconds": max_timeout_seconds,
            },
            "payload": {
                "signature": signature,
                "authorization": {
                    "from": address,
                    "to": recipient,
                    "value": amount,
                    "validAfter": str(valid_after),
                    "validBefore": str(valid_before),
                    "nonce": nonce,
                },
            },
        },
    }

# Initialize Bedrock agent
model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-6-20251101-v1:0",
    region_name=os.environ.get("AWS_REGION", "us-west-2"),
)

agent = Agent(
    model=model,
    tools=[discover_services, request_service, sign_payment],
    system_prompt="""You are an AI assistant that can autonomously access x402-protected content.

When the user asks for content:
1. Call discover_services() to find what's available and at what price
2. Call request_service(endpoint_path) to attempt access
3. If you receive a 402 response, call sign_payment() with the required parameters
4. Call request_service(endpoint_path, payment_payload) with the signed payload
5. Present the content to the user in a clear, readable format

Always inform the user about costs before making payments.""",
)
```

---

## 3-Step Payment Flow Pattern

AWS API Gateway has a 29-second timeout. For complex payment flows, split into steps:

```typescript
// Step 1: Discover what needs to be paid
POST /invoke-agent
Body: { action: "discover", query: "what premium content is available?" }
→ Returns tool list with prices

// Step 2: Execute with payment
POST /invoke-agent
Body: { action: "purchase", endpoint: "/api/market-analysis", approved: true }
→ Agent signs payment, submits to CloudFront, returns content

// Step 3: Process result
The agent returns content + transaction hash
```

```python
# FastAPI proxy splitting the flow
from fastapi import FastAPI
import boto3

app = FastAPI()
bedrock_runtime = boto3.client("bedrock-agentcore-runtime", region_name="us-west-2")

AGENT_RUNTIME_ARN = os.environ["AGENT_RUNTIME_ARN"]

@app.post("/invoke-agent")
async def invoke_agent(request: dict):
    session_id = request.get("session_id", str(uuid.uuid4()))

    response = bedrock_runtime.invoke_agent_runtime(
        agentRuntimeArn=AGENT_RUNTIME_ARN,
        sessionId=session_id,
        inputText=request["message"],
    )

    return {
        "session_id": session_id,
        "response": response["outputText"],
    }
```

---

## Key Constraints & Solutions

| Constraint | Solution |
|---|---|
| Lambda@Edge: no env vars | Bundle `deploy-config.json` with Lambda code at build time |
| Lambda@Edge: no VPC | Use public HTTPS for facilitator calls |
| Lambda@Edge: 30s timeout (viewer-request) | Keep facilitator calls fast; use async where possible |
| CloudFront caches 402 responses | Set `defaultTtl: 0` on payment routes |
| API Gateway: 29s timeout | Split payment flow into multiple API calls |
| Cross-region Lambda@Edge | Always deploy in `us-east-1` (CDK handles this automatically) |
| Payment headers stripped by CloudFront | Configure `OriginRequestPolicy` to forward `X-Payment-Signature` |
