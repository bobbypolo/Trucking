/**
 * Settlement detail component for the LoadPilot trucker app.
 *
 * Renders line items grouped by type (earnings, deductions, reimbursements)
 * with load reference, description, and amount. Shows totals and net pay.
 *
 * # Tests R-P8-05, R-P8-06
 */

import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import type { Settlement, SettlementLine } from "../types/settlement";

interface SettlementDetailProps {
  settlement: Settlement;
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function renderLineItem(line: SettlementLine) {
  return (
    <View key={line.id} style={styles.lineItem}>
      <View style={styles.lineLeft}>
        {line.load_id ? (
          <Text style={styles.loadRef}>Load #{line.load_id}</Text>
        ) : null}
        <Text style={styles.lineDescription}>{line.description}</Text>
      </View>
      <Text style={styles.lineAmount}>{formatCurrency(line.amount)}</Text>
    </View>
  );
}

export default function SettlementDetail({
  settlement,
}: SettlementDetailProps) {
  const earnings = settlement.lines.filter((l) => l.type === "earning");
  const deductions = settlement.lines.filter((l) => l.type === "deduction");
  const reimbursements = settlement.lines.filter(
    (l) => l.type === "reimbursement",
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settlement</Text>
        <Text style={styles.headerStatus}>{settlement.status}</Text>
        <Text style={styles.headerDate}>
          {settlement.period_start && settlement.period_end
            ? `${settlement.period_start} - ${settlement.period_end}`
            : settlement.settlement_date}
        </Text>
      </View>

      {earnings.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <FlatList
            data={earnings}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderLineItem(item)}
            scrollEnabled={false}
          />
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Total Earnings</Text>
            <Text style={styles.subtotalAmount}>
              {formatCurrency(settlement.total_earnings)}
            </Text>
          </View>
        </View>
      ) : null}

      {deductions.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          <FlatList
            data={deductions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderLineItem(item)}
            scrollEnabled={false}
          />
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Total Deductions</Text>
            <Text style={styles.subtotalAmount}>
              {formatCurrency(settlement.total_deductions)}
            </Text>
          </View>
        </View>
      ) : null}

      {reimbursements.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reimbursements</Text>
          <FlatList
            data={reimbursements}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderLineItem(item)}
            scrollEnabled={false}
          />
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Total Reimbursements</Text>
            <Text style={styles.subtotalAmount}>
              {formatCurrency(settlement.total_reimbursements)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.netPayRow}>
        <Text style={styles.netPayLabel}>Net Pay</Text>
        <Text style={styles.netPayAmount}>
          {formatCurrency(settlement.net_pay)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  headerStatus: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
    marginBottom: 2,
  },
  headerDate: { fontSize: 12, color: "#888" },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  lineLeft: { flex: 1, marginRight: 12 },
  loadRef: { fontSize: 12, color: "#666", marginBottom: 2 },
  lineDescription: { fontSize: 14 },
  lineAmount: { fontSize: 14, fontWeight: "500" },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    marginTop: 4,
  },
  subtotalLabel: { fontSize: 14, fontWeight: "600" },
  subtotalAmount: { fontSize: 14, fontWeight: "600" },
  netPayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#333",
    marginTop: 8,
  },
  netPayLabel: { fontSize: 18, fontWeight: "700" },
  netPayAmount: { fontSize: 18, fontWeight: "700" },
});
