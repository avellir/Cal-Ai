/**
 * Goal Flow Entry Point
 * 
 * Redirects to the first step of the goal flow (height-weight)
 */

import { Redirect } from 'expo-router';

export default function GoalFlowIndex() {
  return <Redirect href="/goal-flow/height-weight" />;
}
