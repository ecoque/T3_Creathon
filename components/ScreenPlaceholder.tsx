import { StyleSheet, Text, View } from 'react-native';

type ScreenPlaceholderProps = {
  title: string;
  description?: string;
};

// Faz 2'de gerçek ekran içeriğiyle değiştirilecek.
export function ScreenPlaceholder({ title, description }: ScreenPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});
