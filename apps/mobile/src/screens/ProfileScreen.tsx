// ========== Imports: ==========
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useThemeColors, type ThemeColors } from '../theme/theme';
import { safeGoBack } from '../lib/navigation';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProfilePanel } from '../components/ProfilePanel';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

/**
 * Die volskerm-weergawe van die profiel, bereikbaar via Instellings.
 * Dit wys presies dieselfde paneel as die profiel-kaart wat oor die app oopmaak,
 * met dieselfde kyk- en redigeer-fases.
 */
export function ProfileScreen({ navigation }: Props) {
    const colors = useThemeColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <SafeAreaView style={styles.safe}>
            <ScreenHeader title="My Profiel" onBack={() => safeGoBack(navigation)} />

            <KeyboardAvoidingView
                style={styles.fill}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <ProfilePanel />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        fill: { flex: 1 },
        scroll: { padding: 16, paddingBottom: 32 },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
    });
}
