import { Wallet } from 'lucide-react-native';
import PlaceholderScreen from '@/components/ui/PlaceholderScreen';

export default function FinancesScreen() {
  return (
    <PlaceholderScreen
      icon={Wallet}
      title="Finanse"
      subtitle="Paragony, bank, budżety, statystyki — jedno miejsce na pieniądze."
      accent="#2AC68F"
    />
  );
}
