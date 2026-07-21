// MINIMAL DIAGNOSTIC SCREEN — temporary. Real index backed up at mobile/_backup/index.tsx.
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#16a34a' }}>ABUkonn diagnostic</Text>
      <Text style={{ marginTop: 8, color: '#333' }}>If you can read this, the app launches.</Text>
    </View>
  );
}
