import { Stack } from 'expo-router';
import { GoalFlowProvider } from '@/components/goal-flow/GoalFlowContext';

export default function GoalFlowLayout() {
  return (
    <GoalFlowProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </GoalFlowProvider>
  );
}
