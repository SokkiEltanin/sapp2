import { StyleSheet } from 'react-native';
import { spacing, radius, themedStyles } from '@/theme';

// Style formularza wydatku (AddExpenseModal + ExpenseDetails) — jeden themedStyles, wspólny.
export const makeS = themedStyles((c) => StyleSheet.create({
  fuelLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: c.accent.orange + '66', backgroundColor: c.accent.orange + '14',
  },
  fuelLinkText: { flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.orange },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  headerActions: { flexDirection: 'row', gap: spacing[2] },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },

  typeRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  typeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.bg.card,
    borderWidth: 1, borderColor: c.border.default,
  },
  typeChipActive: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  typeChipLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.text.muted },
  typeChipLabelActive: { color: c.bg.primary },
  ownHint: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[2] },

  section: { marginBottom: spacing[4] },
  label: {
    fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2],
  },
  pasteInput: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], minHeight: 64, marginBottom: spacing[2],
  },
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[2],
  },
  parseBtnLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  btnDisabled: { opacity: 0.35 },

  textInput: {
    fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, borderRadius: radius.sm,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  chipActive: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelActive: { color: c.bg.primary },
  ruleChip: { marginTop: spacing[2], alignSelf: 'flex-start', borderStyle: 'dashed' },
  storeRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing[2] },
  storeInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_800ExtraBold' },
  addItemBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  itemList: { borderTopWidth: 1, borderTopColor: c.border.subtle, marginTop: spacing[1] },
  panel: { backgroundColor: c.ui.in, borderRadius: radius.md, padding: spacing[3], gap: spacing[2], marginBottom: spacing[4] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing[3] },
  pill: { maxWidth: '100%', paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  pillSet: { borderColor: c.text.secondary },
  pillOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  pillTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  pillTxtSet: { color: c.text.bright },
  pillTxtOn: { color: c.bg.primary },
  pillLab: { fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 38, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  datePillLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },

  itemsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 5,
    borderWidth: 1, borderColor: c.border.default,
  },
  addItemLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.bright },
  savingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginTop: spacing[1], flexWrap: 'wrap' },
  savingsText: { flexShrink: 1, fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.accent.green },
  savingsNone: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  savingsBtn: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary, textDecorationLine: 'underline' },
  savingsInput: { minWidth: 90, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary, backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 4 },
  mismatchText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.accent.red, marginTop: spacing[1] },

  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3],
  },
  amountInput: { flex: 1, fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.bright, paddingVertical: spacing[2] },
  currencyLg: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.muted },

  tagInputRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  tagInputField: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  tagAddBtn: {
    width: 40, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center',
  },
  // Wybrane tagi: w rzędzie pigułek (2026-11-23), × usuwa.
  tagRemoveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.text.bright, borderRadius: radius.sm, borderWidth: 1, borderColor: c.text.bright,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
  },
  tagRemoveLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.bg.primary },

  // `footerRoot` = wrapper stopki (ostrzeżenie o duplikacie + kwota/Zapisz).
  footerRoot: {},
  // Ostrzeżenie o możliwym duplikacie (2026-11-11) — ten sam wizualny wzorzec
  // co ProductsModal.tsx's "Możliwe duplikaty" (dupeBtnSecondary/Primary).
  dupWarning: {
    backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.accent.red,
    padding: spacing[3], marginBottom: spacing[3], gap: spacing[2],
  },
  dupWarningText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dupWarningActions: { flexDirection: 'row', gap: spacing[2] },
  dupWarningBtnSecondary: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: c.bg.card, alignItems: 'center' },
  dupWarningBtnSecondaryLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  dupWarningBtnPrimary: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: c.text.bright, alignItems: 'center' },
  dupWarningBtnPrimaryLabel: { fontSize: 11.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  footerAmount: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright },
  saveBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.text.bright },
  saveLabel: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },

  subLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  subLabelGap: { marginTop: spacing[1] },

  // Baner auto-wykrytego paragonu w schowku (2026-11-09) — `c.accent.blue` zamiast
  // zwykłego `c.bg.card` żeby wyraźnie odróżniał się od reszty formularza (jedyny
  // element na ekranie który wymaga decyzji OD RAZU, zanim user przewinie dalej).
  clipboardBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2],
    backgroundColor: `${c.accent.blue}1A`, borderRadius: radius.md, borderWidth: 1, borderColor: `${c.accent.blue}55`,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  clipboardBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  clipboardBannerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  clipboardDismissBtn: { padding: 2 },
  clipboardAcceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.text.bright, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 6,
  },
  clipboardAcceptLabel: { fontSize: 11.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  notFuelBtn: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: c.accent.orange + '55' },
  notFuelLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.accent.orange },
}));
