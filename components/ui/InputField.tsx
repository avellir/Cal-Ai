import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { BorderRadius, DesignColors, Spacing, Typography } from '@/constants/theme';

type InputFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
};

export function InputField({ label, helperText, errorText, style, ...rest }: InputFieldProps) {
  const hasError = Boolean(errorText);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        style={[
          styles.input,
          style,
          hasError && { borderColor: DesignColors.error },
        ]}
        placeholderTextColor={DesignColors.gray400}
      />
      {errorText ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.bodySmallBold,
    color: DesignColors.black,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DesignColors.gray200,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: DesignColors.black,
    backgroundColor: DesignColors.white,
  },
  helper: {
    ...Typography.caption,
    color: DesignColors.gray500,
  },
  error: {
    ...Typography.caption,
    color: DesignColors.error,
    fontFamily: 'Manrope_700Bold',
  },
});
