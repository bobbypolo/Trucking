/**
 * IssueReportForm — modal form for drivers to report issues on a load.
 *
 * Tests R-P7-03: Renders picker with Breakdown, Delay, Detention, Lumper, Other
 * Tests R-P7-04: Renders description TextInput (multiline) and Submit button
 * Tests R-P7-05: Submit disabled when issue_type not selected or description empty
 * Tests R-P7-06: On submit calls reportIssue() then onClose() + onSubmit()
 * Tests R-P7-08: Attach Photo button navigating to camera
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { reportIssue } from "../services/issues";
import { ISSUE_TYPES } from "../types/issue";
import type { IssueType } from "../types/issue";

interface IssueReportFormProps {
  loadId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function IssueReportForm({
  loadId,
  visible,
  onClose,
  onSubmit,
}: IssueReportFormProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<IssueType | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = selectedType !== null && description.trim().length > 0;

  async function handleSubmit() {
    if (!isValid || !selectedType) return;

    setSubmitting(true);
    try {
      await reportIssue({
        issue_type: selectedType,
        load_id: loadId,
        description: description.trim(),
      });
      setSelectedType(null);
      setDescription("");
      onClose();
      onSubmit();
    } finally {
      setSubmitting(false);
    }
  }

  function handleAttachPhoto() {
    router.push({
      pathname: "/(camera)/camera",
      params: { loadId, mode: "issue" },
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView>
            <Text style={styles.title}>Report Issue</Text>

            <Text style={styles.label}>Issue Type</Text>
            <View style={styles.pickerContainer}>
              {ISSUE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeOption,
                    selectedType === type && styles.typeOptionSelected,
                  ]}
                  onPress={() => setSelectedType(type)}
                  accessibilityRole="button"
                  accessibilityLabel={type}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      selectedType === type && styles.typeOptionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              multiline
              numberOfLines={4}
              placeholder="Describe the issue..."
              value={description}
              onChangeText={setDescription}
              accessibilityLabel="Description"
            />

            <Pressable
              style={styles.attachButton}
              onPress={handleAttachPhoto}
              accessibilityRole="button"
              accessibilityLabel="Attach Photo"
            >
              <Text style={styles.attachButtonText}>Attach Photo</Text>
            </Pressable>

            <View style={styles.buttonRow}>
              <Pressable
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitButton,
                  !isValid && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!isValid || submitting}
                accessibilityRole="button"
                accessibilityLabel="Submit"
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? "Submitting..." : "Submit"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  typeOptionSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  typeOptionText: {
    fontSize: 14,
    color: "#4B5563",
  },
  typeOptionTextSelected: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  attachButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
    alignItems: "center",
  },
  attachButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#10B981",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
