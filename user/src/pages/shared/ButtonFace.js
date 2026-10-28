/**
 * ButtonFace
 * -----------
 * Renders the shadow / edge / front layers used by the app's 3D push-button
 * style. Use this inside any clickable element (button, div, etc.) that
 * should have the 3D push effect.
 *
 * Example:
 *   <button className="my-btn" onClick={...}>
 *     <ButtonFace>Submit</ButtonFace>
 *   </button>
 */
const ButtonFace = ({ children, edgeStyle, frontStyle, frontClassName = "" }) => (
  <>
    <span className="shadow shadow-none"></span>
    <span className="edge" style={edgeStyle}></span>
    <span className={`front${frontClassName ? ` ${frontClassName}` : ""}`} style={frontStyle}>
      {children}
    </span>
  </>
);

export default ButtonFace;
