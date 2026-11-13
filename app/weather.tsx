import { Redirect } from 'expo-router';

// Cel kliknięcia widgetu "Pogoda" (sapp2://weather, plugins/withWeatherWidget.js):
// Dashboard z otwartymi szczegółami pogody (index.tsx czyta ?weather=1).
export default function WeatherLink() {
  return <Redirect href={{ pathname: '/', params: { weather: '1' } }} />;
}
