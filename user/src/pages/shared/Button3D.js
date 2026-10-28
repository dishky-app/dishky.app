import ButtonFace from "./ButtonFace";

/**
 * Button3D
 * --------
 * A <button> (or other element via `as`) pre-wired with the app's
 * shadow/edge/front 3D push styling. Pass `className` for the
 * page-specific look (e.g. "show-more-btn", "ty-order-btn", etc.)
 * Any extra props (onClick, disabled, type, style...) are forwarded
 * to the root element.
 *
 * Example:
 *   <Button3D className="continue-btn" disabled={bag.length === 0} onClick={handlePlaceOrder}>
 *     Place Order
 *   </Button3D>
 */
const Button3D = ({
  as = "button",
  className = "",
  children,
  edgeStyle,
  frontStyle,
  frontClassName,
  ...rest
}) => {
  const Tag = as;
  return (
    <Tag className={className} {...rest}>
      <ButtonFace edgeStyle={edgeStyle} frontStyle={frontStyle} frontClassName={frontClassName}>
        {children}
      </ButtonFace>
    </Tag>
  );
};

export default Button3D;