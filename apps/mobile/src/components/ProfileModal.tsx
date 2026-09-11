// ========== Imports: ==========
import { useMemo, useState } from 'react';
import {
    StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors, type ThemeColors } from '../theme/theme';
import { ProfilePanel, type Phase } from './ProfilePanel';

interface Props {
    visible: boolean;
    onClose: () => void;
}

/**
 * Die ingetekende gebruiker se profielkaart. Redigering gebeur binne hierdie
 * selfde raam (sien ProfilePanel). Daar is geen navigasie weg van hier nie.
 */
export function ProfileModal({ visible, onClose }: Props) {
    const colors = useThemeColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [phase, setPhase] = useState<Phase>('view');

    // Terwyl daar geredigeer word, mag die kaart nie per ongeluk toegaan nie
    // die enigste uitgange is Stoor of Kanselleer.
    const dismissable = phase === 'view';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => { if (dismissable) onClose(); }}
        >
            <Pressable
                style={styles.backdrop}
                onPress={() => { if (dismissable) onClose(); }}
            >
                <KeyboardAvoidingView
                    style={styles.keyboardWrap}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <Pressable style={styles.card} onPress={() => {}}>
                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            { visible && <ProfilePanel onPhaseChange={setPhase} />}
                        </ScrollView>

                        {dismissable && (
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={onClose}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Maak toe"
                            >
                                <Feather name="x" size={18} color={colors.textSubtle} />
                            </TouchableOpacity>
                        )}
                    </Pressable>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    );
}

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
        },
        keyboardWrap: { width: '100%', maxHeight: '100%', justifyContent: 'center' },
        card: {
            width: '100%',
            maxWidth: 400,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            // Bind die hoogte sodat die ScrollView binne-in kan rol wanneer die
            // sleutelbord oop is of die inhoud langer is as die skerm.
            maxHeight: '88%',
            overflow: 'hidden',
        },
        closeBtn: { position: 'absolute', top: 12, right: 12, padding: 4 },
    });
}
