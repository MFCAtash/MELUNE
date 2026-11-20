import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { ApiError } from "@codex-music/api-client";
import { apiClient, setAccessToken } from "../lib/api-client";

/**
 * INITIAL SKELETON — see apps/mobile/README.md.
 * One screen, plain <TextInput>/<Pressable> — no form library, no design
 * system, no validation beyond "non-empty". Calls the real
 * `POST /auth/login` through the shared @codex-music/api-client.
 */
export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.login({ email: email.trim(), password });
      setAccessToken(res.accessToken);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0B0B12" }}>
      <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 24 }}>
        Codex Music
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#666"
        autoCapitalize="none"
        keyboardType="email-address"
        style={inputStyle}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#666"
        secureTextEntry
        style={inputStyle}
      />

      {error ? <Text style={{ color: "#ff6b6b", marginBottom: 12 }}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={handleSubmit}
        style={{
          backgroundColor: canSubmit ? "#7C3AED" : "#3a3a44",
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: "center",
        }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Log in</Text>}
      </Pressable>
    </View>
  );
}

const inputStyle = {
  backgroundColor: "#17171f",
  color: "#fff",
  borderRadius: 8,
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 12,
  fontSize: 16,
};
