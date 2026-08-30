import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeArticle } from "../../src/publisher/RecipeArticle";
import { sampleRecipe } from "../../src/publisher/sampleRecipe";

describe("RecipeArticle", () => {
  it("presents the canonical recipe with semantic recipe structure", () => {
    render(<RecipeArticle recipe={sampleRecipe} />);

    const article = screen.getByRole("article", {
      name: "Roasted Chickpea Quinoa Bowl",
    });
    expect(
      within(article).getByRole("heading", {
        level: 1,
        name: "Roasted Chickpea Quinoa Bowl",
      }),
    ).toBeInTheDocument();
    expect(within(article).getByText("Open Table Journal")).toBeInTheDocument();
    expect(within(article).getByText("Serves 4")).toBeInTheDocument();
    expect(within(article).getByText("45 minutes")).toBeInTheDocument();
    expect(
      within(article).getByRole("img", { name: sampleRecipe.image.alt }),
    ).toHaveAttribute("src", sampleRecipe.image.src);

    const ingredients = within(article)
      .getByRole("heading", { name: "Ingredients" })
      .closest("section");
    if (!ingredients) {
      throw new Error("Expected Ingredients to be contained by a section.");
    }
    expect(within(ingredients).getAllByRole("listitem")).toHaveLength(
      sampleRecipe.ingredients.length,
    );

    const instructions = within(article)
      .getByRole("heading", { name: "Method" })
      .closest("section");
    if (!instructions) {
      throw new Error("Expected Method to be contained by a section.");
    }
    expect(within(instructions).getByRole("list").tagName).toBe("OL");
    expect(within(instructions).getAllByRole("listitem")).toHaveLength(
      sampleRecipe.instructions.length,
    );

    for (const note of sampleRecipe.dietaryNotes) {
      expect(within(article).getByText(note)).toBeInTheDocument();
    }
    expect(within(article).queryByText(/todo|task/i)).not.toBeInTheDocument();
  });

  it("keeps the recipe readable when the hero image cannot load", () => {
    render(<RecipeArticle recipe={sampleRecipe} />);

    fireEvent.error(screen.getByRole("img", { name: sampleRecipe.image.alt }));

    expect(
      screen.queryByRole("img", { name: sampleRecipe.image.alt }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(sampleRecipe.image.alt)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ingredients" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Method" })).toBeInTheDocument();
  });
});
