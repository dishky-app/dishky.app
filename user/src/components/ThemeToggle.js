import { useTheme } from './ThemeContext'
import Button3D from "../pages/shared/Button3D";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button3D className="theme-toggle" onClick={toggleTheme}>
      {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
    </Button3D>
  )
}

export default ThemeToggle