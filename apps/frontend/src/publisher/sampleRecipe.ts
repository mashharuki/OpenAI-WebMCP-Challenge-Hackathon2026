import {
  PUBLISHED_RECIPE_ID,
  type RecipeAnalysisInput,
} from "../adgate/contracts";

export interface PublishedRecipe {
  readonly publisher: {
    readonly name: string;
    readonly tagline: string;
  };
  readonly slug: typeof PUBLISHED_RECIPE_ID;
  readonly title: string;
  readonly dek: string;
  readonly servings: number;
  readonly totalMinutes: number;
  readonly tags: readonly string[];
  readonly dietaryNotes: readonly string[];
  readonly image: {
    readonly src: string;
    readonly alt: string;
  };
  readonly ingredients: readonly {
    readonly amount: string;
    readonly item: string;
    readonly preparation?: string;
  }[];
  readonly instructions: readonly {
    readonly title: string;
    readonly detail: string;
  }[];
  readonly analysisInput: RecipeAnalysisInput;
}

const deepFreeze = <Value extends object>(value: Value): Readonly<Value> => {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") {
      deepFreeze(child);
    }
  }

  return Object.freeze(value);
};

export const sampleRecipe = deepFreeze({
  publisher: {
    name: "Open Table Journal",
    tagline: "Thoughtful food for everyday tables.",
  },
  slug: PUBLISHED_RECIPE_ID,
  title: "Roasted Chickpea Quinoa Bowl",
  dek: "Crisp paprika chickpeas, lemony quinoa, and fresh vegetables come together in a colorful bowl built for satisfying lunches.",
  servings: 4,
  totalMinutes: 45,
  tags: ["Plant-forward", "Gluten-free", "Meal-prep friendly"],
  dietaryNotes: [
    "Naturally gluten-free when prepared with certified gluten-free ingredients.",
    "Contains sesame in the tahini dressing.",
  ],
  image: {
    src: "/roasted-chickpea-quinoa-bowl.svg",
    alt: "A bowl of quinoa, roasted chickpeas, greens, and colorful vegetables.",
  },
  ingredients: [
    { amount: "1 cup", item: "quinoa", preparation: "rinsed" },
    {
      amount: "1 can (15 ounces)",
      item: "chickpeas",
      preparation: "drained, rinsed, and dried",
    },
    { amount: "2 tablespoons", item: "extra-virgin olive oil" },
    { amount: "1 teaspoon", item: "smoked paprika" },
    { amount: "1/2 teaspoon", item: "ground cumin" },
    { amount: "2 cups", item: "baby spinach" },
    { amount: "1 cup", item: "cherry tomatoes", preparation: "halved" },
    { amount: "1", item: "small cucumber", preparation: "thinly sliced" },
    { amount: "1/4 cup", item: "tahini" },
    { amount: "1", item: "lemon", preparation: "juiced" },
    { amount: "1/4 cup", item: "water" },
    { amount: "To taste", item: "fine sea salt and black pepper" },
  ],
  instructions: [
    {
      title: "Cook the quinoa",
      detail:
        "Combine the quinoa with 2 cups of water and a pinch of salt. Simmer covered for 15 minutes, then rest off the heat for 5 minutes and fluff.",
    },
    {
      title: "Roast the chickpeas",
      detail:
        "Heat the oven to 425°F (220°C). Toss the chickpeas with 1 tablespoon olive oil, paprika, cumin, salt, and pepper. Roast for 22 to 25 minutes until crisp.",
    },
    {
      title: "Whisk the dressing",
      detail:
        "Whisk the tahini, lemon juice, remaining olive oil, and water until smooth. Season with salt and pepper.",
    },
    {
      title: "Build the bowls",
      detail:
        "Divide the quinoa, spinach, tomatoes, and cucumber among four bowls. Add the roasted chickpeas and finish with the tahini dressing.",
    },
  ],
  analysisInput: {
    recipeId: PUBLISHED_RECIPE_ID,
  },
} as const satisfies PublishedRecipe);
