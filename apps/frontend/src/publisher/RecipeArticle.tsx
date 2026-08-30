import { useState } from "react";
import type { PublishedRecipe } from "./sampleRecipe";

export interface RecipeArticleProps {
  readonly recipe: PublishedRecipe;
}

export function RecipeArticle({ recipe }: RecipeArticleProps) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const titleId = `recipe-${recipe.slug}-title`;
  const dietaryNotesId = `recipe-${recipe.slug}-dietary-notes`;

  return (
    <article
      aria-labelledby={titleId}
      className="min-w-0 overflow-hidden rounded-[2rem] border border-[#d8d0bd] bg-[#fbfaf6] text-[#21352d] shadow-[0_24px_70px_rgba(43,59,49,0.12)]"
    >
      <header className="grid min-w-0 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.82fr)] lg:px-12 lg:py-12">
        <div className="min-w-0 self-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#49765d]">
            {recipe.publisher.name}
          </p>
          <h1
            id={titleId}
            className="max-w-3xl font-serif text-4xl leading-[0.98] font-semibold tracking-[-0.035em] text-balance sm:text-6xl"
          >
            {recipe.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#4f5e56] sm:text-lg">
            {recipe.dek}
          </p>

          <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-3 border-y border-[#d8d0bd] py-4 text-sm">
            <div>
              <dt className="sr-only">Yield</dt>
              <dd className="font-semibold">Serves {recipe.servings}</dd>
            </div>
            <div>
              <dt className="sr-only">Total time</dt>
              <dd className="font-semibold">{recipe.totalMinutes} minutes</dd>
            </div>
          </dl>

          <ul
            aria-label="Recipe features"
            className="mt-5 flex flex-wrap gap-2"
          >
            {recipe.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-[#9bb2a3] bg-[#edf3ec] px-3 py-1 text-xs font-medium text-[#315843]"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>

        <figure className="min-w-0 overflow-hidden rounded-[1.5rem] bg-[#e8eadc]">
          {imageUnavailable ? (
            <figcaption className="grid aspect-[5/4] min-h-64 place-content-center gap-3 px-8 text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#49765d]">
                Image unavailable
              </span>
              <span className="max-w-sm font-serif text-2xl leading-snug">
                {recipe.image.alt}
              </span>
            </figcaption>
          ) : (
            <img
              src={recipe.image.src}
              alt={recipe.image.alt}
              className="aspect-[5/4] h-full w-full object-cover"
              onError={() => setImageUnavailable(true)}
            />
          )}
        </figure>
      </header>

      <div className="grid min-w-0 border-t border-[#d8d0bd] lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)]">
        <section
          aria-labelledby="recipe-ingredients-title"
          className="min-w-0 bg-[#f2eee4] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bd5b42]">
            The pantry edit
          </p>
          <h2
            id="recipe-ingredients-title"
            className="mt-2 font-serif text-3xl font-semibold"
          >
            Ingredients
          </h2>
          <ul className="mt-6 divide-y divide-[#d8d0bd]">
            {recipe.ingredients.map((ingredient) => (
              <li
                key={`${ingredient.amount}-${ingredient.item}`}
                className="grid grid-cols-[minmax(5.5rem,0.42fr)_minmax(0,1fr)] gap-3 py-3 text-sm leading-6"
              >
                <span className="font-semibold text-[#315843]">
                  {ingredient.amount}
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {ingredient.item}
                  {ingredient.preparation ? `, ${ingredient.preparation}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <section aria-labelledby="recipe-method-title">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bd5b42]">
              From the test kitchen
            </p>
            <h2
              id="recipe-method-title"
              className="mt-2 font-serif text-3xl font-semibold"
            >
              Method
            </h2>
            <ol className="mt-7 space-y-7">
              {recipe.instructions.map((instruction, index) => (
                <li
                  key={instruction.title}
                  className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-4"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 place-items-center rounded-full bg-[#e2a93b] font-mono text-sm font-bold text-[#21352d]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{instruction.title}</h3>
                    <p className="mt-1 leading-7 text-[#4f5e56]">
                      {instruction.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside
            aria-labelledby={dietaryNotesId}
            className="mt-10 border-l-4 border-[#49765d] bg-[#edf3ec] px-5 py-4"
          >
            <h2 id={dietaryNotesId} className="text-sm font-semibold">
              Dietary notes
            </h2>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-[#4f5e56]">
              {recipe.dietaryNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </article>
  );
}
