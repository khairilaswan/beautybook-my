import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useI18n } from "@/lib/i18n";
import { colors, radius, shadow, space } from "@/lib/theme";

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  ...rest
}: ScrollViewProps & { refreshing?: boolean; onRefresh?: () => void; contentStyle?: ViewStyle }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand600} /> : undefined
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

type ButtonVariant = "primary" | "brand" | "whatsapp" | "outline" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  small,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const v = BUTTON_VARIANTS[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || off) && { opacity: off ? 0.55 : 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const BUTTON_VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.ink, fg: colors.white, border: colors.ink },
  brand: { bg: colors.brand600, fg: colors.white, border: colors.brand600 },
  whatsapp: { bg: colors.whatsapp, fg: colors.white, border: colors.whatsapp },
  outline: { bg: colors.white, fg: colors.ink, border: colors.line },
  ghost: { bg: "transparent", fg: colors.ink, border: "transparent" },
  danger: { bg: colors.white, fg: colors.danger, border: colors.line },
};

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.8 }, style]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; style?: TextStyle }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[styles.input, props.multiline && styles.inputMultiline, style]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.h2} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: PressableProps["onPress"] }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand600} size="large" />
    </View>
  );
}

export function ErrorView({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.center}>
      <Text style={[styles.body, { textAlign: "center" }]}>{message ?? t.common.offline}</Text>
      {onRetry ? <Button title={t.common.retry} onPress={onRetry} variant="outline" style={{ marginTop: space(4) }} /> : null}
    </View>
  );
}

export function Empty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space(10) }]}>
      <Text style={[styles.h3, { textAlign: "center" }]}>{title}</Text>
      {body ? <Text style={[styles.muted, { textAlign: "center", marginTop: space(2) }]}>{body}</Text> : null}
      {children}
    </View>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <Text style={{ color: colors.brand600, fontSize: size }} accessibilityLabel={`${value} / 5`}>
      {"★★★★★".slice(0, Math.round(value))}
      <Text style={{ color: colors.line }}>{"★★★★★".slice(Math.round(value))}</Text>
    </Text>
  );
}

export function Pill({ label, tone = "plain" }: { label: string; tone?: "plain" | "brand" | "green" }) {
  const bg = tone === "brand" ? colors.brand50 : tone === "green" ? colors.green50 : colors.white;
  const fg = tone === "brand" ? colors.brand700 : tone === "green" ? colors.whatsapp : colors.ink;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = "brand" }: { text: string; tone?: "brand" | "green" | "error" }) {
  const bg = tone === "green" ? colors.green50 : tone === "error" ? "#fef3f2" : colors.brand50;
  const fg = tone === "error" ? colors.danger : colors.ink;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole={tone === "error" ? "alert" : undefined}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  screenContent: { padding: space(4), paddingBottom: space(16), gap: space(6) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space(6), backgroundColor: colors.canvas },
  h1: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontWeight: "600", color: colors.ink },
  h3: { fontSize: 16, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 20, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
  link: { fontSize: 14, color: colors.ink, textDecorationLine: "underline" },
  row: { flexDirection: "row", alignItems: "center", gap: space(2) },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space(4),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space(3), borderRadius: radius.pill },
  buttonText: { fontSize: 16, fontWeight: "600" },
  buttonTextSmall: { fontSize: 14, fontWeight: "500" },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, color: colors.ink },
  chipTextSelected: { color: colors.white, fontWeight: "500" },
  field: { gap: space(1) },
  label: { fontSize: 14, fontWeight: "500", color: colors.ink },
  hint: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    fontSize: 16,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  section: { gap: space(3) },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
    gap: space(1),
    ...shadow,
  },
  pill: { borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  pillText: { fontSize: 12, fontWeight: "500" },
  notice: { borderRadius: radius.lg, padding: space(4) },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
