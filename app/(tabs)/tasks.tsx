import { CheckSquare } from 'lucide-react-native';
import PlaceholderScreen from '@/components/ui/PlaceholderScreen';

export default function TasksScreen() {
  return (
    <PlaceholderScreen
      icon={CheckSquare}
      title="Zadania"
      subtitle="Terminowe, Teraz, Poczekalnia — plus kalendarz obok, nie osobno."
      accent="#6C9EFF"
    />
  );
}
