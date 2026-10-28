import './IngredientDetail.css'
import { useParams } from 'react-router-dom'
import calorieIcon from "../assets/icons/calorie.png";
import proteinIcon from "../assets/icons/protein.png";
import fatIcon from "../assets/icons/fat.png";
import fibreIcon from "../assets/icons/fiber.png";
import { handleImgFallback } from "../App";

const NUTRITION_CONFIG = [
  {
    key: "kcal",
    label: "Calories",
    unit: "kcal",
    icon: calorieIcon
  },
  {
    key: "protein",
    label: "Protein",
    unit: "g",
    icon: proteinIcon
  },
  {
    key: "fat",
    label: "Fat",
    unit: "g",
    icon: fatIcon
  },
  {
    key: "fibre",
    label: "Fibre",
    unit: "g",
    icon: fibreIcon
  }
];

const IngredientDetail = ({ handleBack, foodData }) => {
  const { id } = useParams()

  const ingredient = foodData.ingredients.find(
    (item) => item.id === id
  )

  if (!ingredient) {
    return <p>Ingredient not found</p>
  }

  if (ingredient.isDisabledGlobally) {
    return <p>This ingredient is currently unavailable.</p>;
  }

  return (
    <div className="ingredient-detail">

      <div className="left">
        <button
          className="ingredient-back-button"
          aria-label="Go back"
          onClick={handleBack}
        ></button>
        <div className="ingredient-detail-image">
          <img
            src={ingredient.image}
            alt={ingredient.name}
            loading="lazy"
            decoding="async"
            onError={handleImgFallback} />
        </div>
      </div>

      <div className="right">
        <div className="pl-header">
          <h2 className="ingredient-name">
            {ingredient.name}
          </h2>

          <div className="ingredient-cost">
            ₹{ingredient.pricePer100g} / 100g
          </div>
        </div>

        <div className='pl-body'>
          <div className="description-section">
            <p>{ingredient.description}</p>
          </div>

          <div className="benefits-section">
            <h3>Health Benefits (per 100g)</h3>

            <div className="ingredient-nutrition">
              {NUTRITION_CONFIG.map(({ key, label, unit, icon }) => {
                const value = ingredient.nutritionPer100g?.[key];

                if (value == null) return null;

                return (
                  <div className="ingredient-nutrition-item" key={key}>
                    <div className="ingredient-nutrition-image">
                      <img src={icon} alt={label} />
                    </div>

                    <div className="ingredient-nutrition-value">
                      {value} {unit}
                    </div>

                    <div className="ingredient-nutrition-name">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="history-section">
            <h3>History</h3>
            <p>{ingredient.history}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IngredientDetail
