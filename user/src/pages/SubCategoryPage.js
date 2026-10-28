import "./SubCategoryPage.css";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "./shared/PageHeader";
import { handleImgFallback } from "../App";

const SubCategoryPage = ({ foodData, handleBack, handleHome }) => {
  const { categoryId } = useParams();
  const navigate = useNavigate();

  const category = foodData.categories.find(
    c => c.id === categoryId
  );

  const subCategories = category?.subCategories || [];

  return (
    <div className="no-padding">
      <PageHeader title={category?.name} onBack={handleBack} onHome={handleHome} />

      <div className="pl-body food-category">
        <div className="food-category-container">
          {subCategories.map(sub => (
            <div
              key={sub.id}
              className="food-category-items"
              onClick={() => navigate(`/foods/${sub.id}/grid`)}
            >
              <div className="food-category-image">
                <img src={sub.image} alt={sub.name}  onError={handleImgFallback} />
              </div>

              <div className="food-category-name">
                {sub.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubCategoryPage;