package main

import (
	"encoding/json"
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
