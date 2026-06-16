import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ABUkonn</Text>
      <Text style={styles.subtitle}>Ahmadu Bello University</Text>
      {user ? (
        <Text style={styles.text}>Welcome, {user.full_name}!</Text>
      ) : (
        <Text style={styles.text}>Mobile app — SDK 52 ready</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 24,
  },
  text: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
});
