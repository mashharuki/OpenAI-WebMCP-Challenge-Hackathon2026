export const developmentProxy = {
  "/api": {
    target: "http://127.0.0.1:4021",
    changeOrigin: true,
  },
} as const;
