package main

import (
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIsAntigravityAccount(t *testing.T) {
	for _, source := range []string{"antigravity", "AntiGravity", "agy", "google-antigravity"} {
		if !isAntigravityAccount(OpenAIAccount{Source: source}) {
			t.Fatalf("expected source %q to be recognized as antigravity", source)
		}
	}
	for _, source := range []string{"", "cpa", "codex", "sub2api"} {
		if isAntigravityAccount(OpenAIAccount{Source: source}) {
			t.Fatalf("source %q should not be antigravity", source)
		}
	}
}

func TestBuildAntigravityPayloadEnvelope(t *testing.T) {
	call := GatewayCall{
		Model: Model{ID: "gemini-3.7-flash-high"},
		Body: ChatRequest{
			Model: "gemini-3.7-flash-high",
			Messages: []ChatMessage{
				{Role: "system", Content: "be terse"},
				{Role: "user", Content: "hello"},
				{Role: "assistant", Content: "hi"},
			},
			Payload: map[string]interface{}{"temperature": 0.5, "max_tokens": 1024},
		},
	}

	encoded, providerErr := buildAntigravityPayload(call, "proj-123")
	if providerErr != nil {
		t.Fatalf("unexpected provider error: %+v", providerErr)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatalf("payload is not valid JSON: %v", err)
	}

	if payload["model"] != "gemini-3.7-flash-high" {
		t.Fatalf("model should be forwarded verbatim, got %v", payload["model"])
	}
	if payload["project"] != "proj-123" {
		t.Fatalf("project not set, got %v", payload["project"])
	}
	if payload["requestType"] != "agent" {
		t.Fatalf("requestType should be agent, got %v", payload["requestType"])
	}

	request, ok := payload["request"].(map[string]interface{})
	if !ok {
		t.Fatalf("request envelope missing")
	}
	if _, ok := request["systemInstruction"]; !ok {
		t.Fatalf("system message should become systemInstruction")
	}
	contents, ok := request["contents"].([]interface{})
	if !ok || len(contents) != 2 {
		t.Fatalf("expected 2 non-system contents, got %v", request["contents"])
	}
	first := contents[0].(map[string]interface{})
	if first["role"] != "user" {
		t.Fatalf("first content role should be user, got %v", first["role"])
	}
	second := contents[1].(map[string]interface{})
	if second["role"] != "model" {
		t.Fatalf("assistant should map to model role, got %v", second["role"])
	}

	// max_tokens is dropped for non-Claude models.
	if gc, ok := request["generationConfig"].(map[string]interface{}); ok {
		if _, present := gc["maxOutputTokens"]; present {
			t.Fatalf("maxOutputTokens should be omitted for non-Claude models")
		}
		if gc["temperature"] != 0.5 {
			t.Fatalf("temperature should carry through, got %v", gc["temperature"])
		}
	} else {
		t.Fatalf("generationConfig missing")
	}
}

func TestBuildAntigravityPayloadKeepsMaxTokensForClaude(t *testing.T) {
	call := GatewayCall{
		Model: Model{ID: "claude-sonnet-4-6"},
		Body: ChatRequest{
			Messages: []ChatMessage{{Role: "user", Content: "hi"}},
			Payload:  map[string]interface{}{"max_tokens": 2048},
		},
	}
	encoded, providerErr := buildAntigravityPayload(call, "p")
	if providerErr != nil {
		t.Fatalf("unexpected provider error: %+v", providerErr)
	}
	var payload map[string]interface{}
	_ = json.Unmarshal(encoded, &payload)
	request := payload["request"].(map[string]interface{})
	gc := request["generationConfig"].(map[string]interface{})
	if gc["maxOutputTokens"] != float64(2048) {
		t.Fatalf("Claude route should keep maxOutputTokens, got %v", gc["maxOutputTokens"])
	}
}

func TestParseAntigravityResponseWrapped(t *testing.T) {
	body := []byte(`{"response":{"candidates":[{"content":{"role":"model","parts":[{"text":"hello "},{"text":"world"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":11,"candidatesTokenCount":22,"totalTokenCount":33}}}`)
	text, parsed := parseAntigravityResponse(body)
	if text != "hello world" {
		t.Fatalf("expected concatenated text, got %q", text)
	}
	usage := antigravityUsage(parsed, nil)
	if usage["prompt_tokens"] != 11 || usage["completion_tokens"] != 22 || usage["total_tokens"] != 33 {
		t.Fatalf("usage mismatch: %+v", usage)
	}
}

func TestAntigravityPartsMultimodal(t *testing.T) {
	content := []interface{}{
		map[string]interface{}{"type": "text", "text": "look"},
		map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": "data:image/png;base64,AAAA"}},
	}
	parts := antigravityParts(content)
	if len(parts) != 2 {
		t.Fatalf("expected 2 parts, got %d", len(parts))
	}
	if parts[0]["text"] != "look" {
		t.Fatalf("first part should be text, got %+v", parts[0])
	}
	inline, ok := parts[1]["inlineData"].(gin.H)
	if !ok {
		t.Fatalf("second part should carry inlineData, got %+v", parts[1])
	}
	if inline["mimeType"] != "image/png" || inline["data"] != "AAAA" {
		t.Fatalf("inlineData mismatch: %+v", inline)
	}
}

func TestParseDataURL(t *testing.T) {
	mime, data, ok := parseDataURL("data:image/jpeg;base64,Zm9v")
	if !ok || mime != "image/jpeg" || data != "Zm9v" {
		t.Fatalf("unexpected parse: mime=%q data=%q ok=%v", mime, data, ok)
	}
	if _, _, ok := parseDataURL("https://example.com/x.png"); ok {
		t.Fatalf("non data URL should not parse")
	}
	if _, _, ok := parseDataURL("data:text/plain,notbase64"); ok {
		t.Fatalf("non-base64 data URL should not parse")
	}
}

func TestAntigravityChannelIsNotCodex(t *testing.T) {
	// A first-class Antigravity pool must route through the antigravity path,
	// never the codex path, even once it holds accounts.
	channel := Channel{Provider: "antigravity", OpenAIAccounts: []OpenAIAccount{{ID: "a", AccessToken: "x", Source: "antigravity"}}}
	if !isAntigravityChannel(channel) {
		t.Fatalf("expected antigravity channel")
	}
	if isCodexChannel(channel) {
		t.Fatalf("antigravity channel must not be treated as codex")
	}
	codex := Channel{Provider: "codex", OpenAIAccounts: []OpenAIAccount{{ID: "b", AccessToken: "x"}}}
	if isAntigravityChannel(codex) || !isCodexChannel(codex) {
		t.Fatalf("codex channel classification regressed")
	}
}

func TestAntigravityClientSecretDecodes(t *testing.T) {
	if antigravityOAuthClientSecret == "" {
		t.Fatalf("client secret failed to decode")
	}
	if strings.ContainsAny(antigravityOAuthClientSecret, "\x00") {
		t.Fatalf("client secret decoded to garbage")
	}
}

func TestAntigravityAuthorizeURL(t *testing.T) {
	raw := antigravityAuthorizeURL("chal-123", "state-abc")
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("authorize URL does not parse: %v", err)
	}
	if got := parsed.Scheme + "://" + parsed.Host + parsed.Path; got != antigravityOAuthAuthorizeEndpoint {
		t.Fatalf("authorize endpoint = %q, want %q", got, antigravityOAuthAuthorizeEndpoint)
	}
	query := parsed.Query()
	checks := map[string]string{
		"response_type":         "code",
		"client_id":             antigravityOAuthClientID,
		"redirect_uri":          antigravityOAuthRedirectURI,
		"scope":                 antigravityOAuthScope,
		"code_challenge":        "chal-123",
		"code_challenge_method": "S256",
		"access_type":           "offline",
		"prompt":                "consent",
		"state":                 "state-abc",
	}
	for key, want := range checks {
		if got := query.Get(key); got != want {
			t.Fatalf("authorize param %q = %q, want %q", key, got, want)
		}
	}
	// A refresh token is only issued when cloud-platform scope is granted.
	if !strings.Contains(query.Get("scope"), "cloud-platform") {
		t.Fatalf("scope must request cloud-platform, got %q", query.Get("scope"))
	}
}

func TestAntigravityUserAgentForIsStableAndSpread(t *testing.T) {
	// The same account always reports the same platform (a real single-device
	// user), and the chosen platform is always drawn from the pool.
	poolSet := map[string]bool{}
	for _, platform := range antigravityPlatforms {
		poolSet[platform] = true
	}
	account := OpenAIAccount{ID: "oaiacc_abc"}
	first := antigravityPlatformFor(account)
	if !poolSet[first] {
		t.Fatalf("platform %q not from pool", first)
	}
	for i := 0; i < 5; i++ {
		if got := antigravityPlatformFor(account); got != first {
			t.Fatalf("platform not stable for same account: %q vs %q", got, first)
		}
	}

	// Across many accounts the selection spreads over more than one platform,
	// so the pool does not fingerprint as a single identical client.
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		seen[antigravityPlatformFor(OpenAIAccount{ID: "oaiacc_" + strconv.Itoa(i)})] = true
	}
	if len(seen) < 2 {
		t.Fatalf("platform selection did not spread across the pool: %v", seen)
	}

	// The UA carries the configured version and a pool platform; an empty version
	// falls back to the default, and an identifierless account uses platform[0].
	ua := antigravityUserAgentFor("3.0.0", account)
	if !strings.HasPrefix(ua, "antigravity/hub/3.0.0 ") {
		t.Fatalf("UA should carry the configured version, got %q", ua)
	}
	if got := antigravityUserAgentFor("", OpenAIAccount{}); got != "antigravity/hub/"+antigravityDefaultClientVersion+" "+antigravityPlatforms[0] {
		t.Fatalf("empty version + empty account should yield the canonical default UA, got %q", got)
	}
}

func TestAntigravityVersionValid(t *testing.T) {
	for _, ok := range []string{"2.9.1", "2.10.0", "3.0.0-beta", "3.0.0+build.2", "12"} {
		if !antigravityVersionValid(ok) {
			t.Fatalf("version %q should be valid", ok)
		}
	}
	for _, bad := range []string{"2.9.1 darwin", "", "2.9.1;rm -rf", "\n2.9", "版本"} {
		if antigravityVersionValid(bad) {
			t.Fatalf("version %q should be rejected", bad)
		}
	}
}

func TestPickAntigravityProbeAccount(t *testing.T) {
	channel := Channel{OpenAIAccounts: []OpenAIAccount{
		{ID: "a", Status: "invalid", AccessToken: "x"},
		{ID: "b", Status: "healthy", RefreshToken: "r"},
		{ID: "c", Status: "unchecked"}, // no credential
	}}
	// Prefers a healthy account with a credential.
	if account, ok := pickAntigravityProbeAccount(channel, ""); !ok || account.ID != "b" {
		t.Fatalf("expected healthy account b, got %q ok=%v", account.ID, ok)
	}
	// Honors an explicit account selection even if not healthy.
	if account, ok := pickAntigravityProbeAccount(channel, "a"); !ok || account.ID != "a" {
		t.Fatalf("expected explicitly selected account a, got %q ok=%v", account.ID, ok)
	}
	// A pool with no usable credentials yields nothing.
	empty := Channel{OpenAIAccounts: []OpenAIAccount{{ID: "c", Status: "unchecked"}}}
	if _, ok := pickAntigravityProbeAccount(empty, ""); ok {
		t.Fatalf("expected no probe account when none carry a credential")
	}
}
