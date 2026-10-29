export const food = (id: number, name: string, calories = 150) => ({
  food_id: String(id), food_name: name, food_type: 'Generic',
  food_url: 'https://foods.fatsecret.com/calories-nutrition/generic/fixture',
  food_description: 'Per 100g - Calories: ' + calories + 'kcal | Fat: 5g | Carbs: 6g | Protein: 20g',
  servings: { serving: [
    { serving_id: '1', serving_description: '100 g', metric_serving_amount: '100', metric_serving_unit: 'g',
      calories: String(calories), protein: '20', fat: '5', carbohydrate: '6' },
    { serving_id: '2', serving_description: '1 piece', metric_serving_amount: '85', metric_serving_unit: 'g',
      calories: String(calories * 0.85), protein: '17', fat: '4.25', carbohydrate: '5.1' },
  ] },
});
export const search = (foods: ReturnType<typeof food>[]) => new Response(JSON.stringify({ foods: { food: foods } }));
export const details = (record: ReturnType<typeof food>) => new Response(JSON.stringify({ food: record }));
export const accessToken = () => new Response(JSON.stringify({ access_token: 'private-access-token', expires_in: 86400 }));
