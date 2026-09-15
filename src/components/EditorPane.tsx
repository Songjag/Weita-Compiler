import React, { useRef, useEffect } from "react";
import MonacoEditor, { OnMount, loader } from "@monaco-editor/react";
import { Language, MONACO_LANGUAGE } from "../types";
import { Theme } from "../store/appStore";
import { makeT, UILang } from "../i18n/useI18n";
import type * as Monaco from "monaco-editor";

// Tắt web workers của Monaco để tránh lỗi trong Tauri WebView
// (Workers cần blob URL không hỗ trợ trong CSP của Tauri release)
loader.config({
  "vs/nls": { availableLanguages: {} },
});

interface EditorPaneProps {
  language: Language;
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
  isRunning: boolean;
  theme: Theme;
  fontSize: number;
  uiLang: UILang;
  fileName: string;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  language,
  code,
  onChange,
  onRun,
  onStop,
  onSave,
  isRunning,
  theme,
  fontSize,
  uiLang,
  fileName,
}) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [copied, setCopied] = React.useState(false);
  const T = makeT(uiLang);

  // Đồng bộ theme khi user toggle light/dark
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === "dark" ? "wcompiler-dark" : "wcompiler-light");
    }
  }, [theme]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // ── Define custom themes ─────────────────────────────────────────
    monaco.editor.defineTheme("wcompiler-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment",  foreground: "6c7086", fontStyle: "italic" },
        { token: "keyword",  foreground: "cba6f7", fontStyle: "bold" },
        { token: "string",   foreground: "a6e3a1" },
        { token: "number",   foreground: "fab387" },
        { token: "type",     foreground: "89dceb" },
        { token: "function", foreground: "89b4fa" },
      ],
      colors: {
        "editor.background":           "#1e1e2e",
        "editor.foreground":           "#cdd6f4",
        "editor.lineHighlightBackground": "#313244",
        "editorLineNumber.foreground": "#45475a",
        "editorLineNumber.activeForeground": "#cdd6f4",
        "editorCursor.foreground":     "#f5c2e7",
        "editor.selectionBackground":  "#45475a",
        "editorIndentGuide.background1": "#313244",
        "editorBracketMatch.background": "#45475a88",
        "editorSuggestWidget.background":   "#181825",
        "editorSuggestWidget.border":       "#313244",
        "editorSuggestWidget.selectedBackground": "#313244",
        "editorHoverWidget.background": "#181825",
        "editorHoverWidget.border":     "#313244",
      },
    });

    monaco.editor.defineTheme("wcompiler-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment",  foreground: "8c8fa1", fontStyle: "italic" },
        { token: "keyword",  foreground: "8839ef", fontStyle: "bold" },
        { token: "string",   foreground: "40a02b" },
        { token: "number",   foreground: "fe640b" },
        { token: "type",     foreground: "04a5e5" },
        { token: "function", foreground: "1e66f5" },
      ],
      colors: {
        "editor.background":           "#eff1f5",
        "editor.foreground":           "#4c4f69",
        "editor.lineHighlightBackground": "#e6e9ef",
        "editorLineNumber.foreground": "#acb0be",
        "editorLineNumber.activeForeground": "#4c4f69",
        "editorCursor.foreground":     "#dc8a78",
        "editor.selectionBackground":  "#ccd0da",
        "editorSuggestWidget.background":   "#e6e9ef",
        "editorSuggestWidget.border":       "#ccd0da",
        "editorSuggestWidget.selectedBackground": "#ccd0da",
        "editorHoverWidget.background": "#e6e9ef",
        "editorHoverWidget.border":     "#ccd0da",
      },
    });

    monaco.editor.setTheme(theme === "dark" ? "wcompiler-dark" : "wcompiler-light");

    // ── C/C++ IntelliSense snippets & completions ────────────────────
    registerCppCompletions(monaco);

    // ── Keybindings ──────────────────────────────────────────────────
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!isRunning) onRun();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    editor.onKeyDown((event) => {
      if (!(event.ctrlKey || event.metaKey) || event.keyCode !== monaco.KeyCode.KeyC) return;
      const sel = editor.getSelection();
      if ((!sel || sel.isEmpty()) && isRunning) {
        event.preventDefault();
        event.stopPropagation();
        onStop();
      }
    });

    editor.focus();
  };

  return (
    <div className="editor-pane">
      <div className="editor-file-tab">
        <span className="file-tab active">
          {fileName}
        </span>
        <button
          className="copy-code-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            } catch (error) {
              console.error("Copy failed:", error);
            }
          }}
          title={T("copyCode")}
        >
          {copied ? T("copied") : T("copyCode")}
        </button>
      </div>
      <div className="editor-body">
        <MonacoEditor
          height="100%"
          language={MONACO_LANGUAGE[language]}
          value={code}
          theme={theme === "dark" ? "wcompiler-dark" : "wcompiler-light"}
          onChange={(val) => onChange(val ?? "")}
          onMount={handleMount}
          options={{
            fontSize: fontSize,
            fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
            fontLigatures: true,
            minimap: { enabled: true },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: "off",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            padding: { top: 8 },
            // ── IntelliSense / suggestions ──────────────────────────
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: "on",
            tabCompletion: "on",
            wordBasedSuggestions: "currentDocument",
            parameterHints: { enabled: true },
            hover: { enabled: true },
            inlayHints: { enabled: "on" },
            snippetSuggestions: "inline",
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showClasses: true,
              showFunctions: true,
              showVariables: true,
              showConstructors: true,
              showMethods: true,
              filterGraceful: true,
              insertMode: "replace",
            },
          }}
        />
      </div>
    </div>
  );
};

// ─── C/C++ completions & snippets ─────────────────────────────────────────────

function registerCppCompletions(monaco: typeof Monaco) {
  const LANGS = ["c", "cpp"];

  LANGS.forEach((lang) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ["#", "<", "."],
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
        const hasIntReturnType = /\bint\s+$/.test(linePrefix.slice(0, linePrefix.length - word.word.length));
        const includePrefix = linePrefix.match(/(^|\s)#(?:include)?$/);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: includePrefix
            ? position.column - includePrefix[0].trim().length
            : word.startColumn,
          endColumn: word.endColumn,
        };
        const CK = monaco.languages.CompletionItemKind;

        const snippets: Monaco.languages.CompletionItem[] = [
          // ── Includes ──────────────────────────────────────────────
          {
            label: "#include <bits/stdc++.h>",
            kind: CK.Module,
            insertText: "#include <bits/stdc++.h>",
            documentation: "Include all standard headers (competitive programming)",
            range,
          },
          {
            label: "#include <iostream>",
            kind: CK.Module,
            insertText: "#include <iostream>",
            range,
          },
          {
            label: "#include <vector>",
            kind: CK.Module,
            insertText: "#include <vector>",
            range,
          },
          {
            label: "#include <string>",
            kind: CK.Module,
            insertText: "#include <string>",
            range,
          },
          {
            label: "#include <algorithm>",
            kind: CK.Module,
            insertText: "#include <algorithm>",
            range,
          },
          {
            label: "#include <map>",
            kind: CK.Module,
            insertText: "#include <map>",
            range,
          },
          {
            label: "#include <set>",
            kind: CK.Module,
            insertText: "#include <set>",
            range,
          },
          {
            label: "#include <queue>",
            kind: CK.Module,
            insertText: "#include <queue>",
            range,
          },
          {
            label: "#include <stack>",
            kind: CK.Module,
            insertText: "#include <stack>",
            range,
          },
          {
            label: "#include <cmath>",
            kind: CK.Module,
            insertText: "#include <cmath>",
            range,
          },
          {
            label: "#include <cstring>",
            kind: CK.Module,
            insertText: "#include <cstring>",
            range,
          },
          {
            label: "#include <stdio.h>",
            kind: CK.Module,
            insertText: "#include <stdio.h>",
            range,
          },
          // ── main template ─────────────────────────────────────────
          {
            label: "main",
            kind: CK.Snippet,
            insertText: hasIntReturnType
              ? "main() {\n\t$0\n\treturn 0;\n}"
              : "int main() {\n\t$0\n\treturn 0;\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "main function",
            range,
          },
          {
            label: "main-fast",
            kind: CK.Snippet,
            insertText: [
              hasIntReturnType ? "main() {" : "int main() {",
              "\tios_base::sync_with_stdio(false);",
              "\tcin.tie(NULL);",
              "\t$0",
              "\treturn 0;",
              "}",
            ].join("\n"),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "main with fast I/O",
            range,
          },
          // ── Control flow ──────────────────────────────────────────
          {
            label: "for",
            kind: CK.Snippet,
            insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "for loop",
            range,
          },
          {
            label: "fori",
            kind: CK.Snippet,
            insertText: "for (int ${1:i} = ${2:0}; ${1:i} <= ${3:n}; ${1:i}++) {\n\t$0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "for loop (inclusive)",
            range,
          },
          {
            label: "while",
            kind: CK.Snippet,
            insertText: "while (${1:condition}) {\n\t$0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "if",
            kind: CK.Snippet,
            insertText: "if (${1:condition}) {\n\t$0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "ifelse",
            kind: CK.Snippet,
            insertText: "if (${1:condition}) {\n\t$0\n} else {\n\t\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "switch",
            kind: CK.Snippet,
            insertText: "switch (${1:var}) {\n\tcase ${2:val}:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          // ── Functions ─────────────────────────────────────────────
          {
            label: "fn",
            kind: CK.Snippet,
            insertText: "${1:void} ${2:functionName}(${3:params}) {\n\t$0\n}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "function definition",
            range,
          },
          // ── I/O ───────────────────────────────────────────────────
          {
            label: "cout",
            kind: CK.Snippet,
            insertText: 'cout << ${1:value} << endl;',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "cin",
            kind: CK.Snippet,
            insertText: "cin >> ${1:var};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "printf",
            kind: CK.Snippet,
            insertText: 'printf("${1:%d}\\n", ${2:var});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "scanf",
            kind: CK.Snippet,
            insertText: 'scanf("${1:%d}", &${2:var});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          // ── STL containers ────────────────────────────────────────
          {
            label: "vector",
            kind: CK.Snippet,
            insertText: "vector<${1:int}> ${2:v};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "vector-n",
            kind: CK.Snippet,
            insertText: "vector<${1:int}> ${2:v}(${3:n});",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "vector with size n",
            range,
          },
          {
            label: "map",
            kind: CK.Snippet,
            insertText: "map<${1:string}, ${2:int}> ${3:m};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "unordered_map",
            kind: CK.Snippet,
            insertText: "unordered_map<${1:string}, ${2:int}> ${3:m};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "set",
            kind: CK.Snippet,
            insertText: "set<${1:int}> ${2:s};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "priority_queue",
            kind: CK.Snippet,
            insertText: "priority_queue<${1:int}> ${2:pq};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "pq-min",
            kind: CK.Snippet,
            insertText: "priority_queue<${1:int}, vector<${1:int}>, greater<${1:int}>> ${2:pq};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "min priority_queue",
            range,
          },
          // ── Struct / class ────────────────────────────────────────
          {
            label: "struct",
            kind: CK.Snippet,
            insertText: "struct ${1:Name} {\n\t$0\n};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "class",
            kind: CK.Snippet,
            insertText: "class ${1:Name} {\npublic:\n\t$0\n};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          // ── Algorithms ────────────────────────────────────────────
          {
            label: "sort",
            kind: CK.Snippet,
            insertText: "sort(${1:v}.begin(), ${1:v}.end());",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "sort-desc",
            kind: CK.Snippet,
            insertText: "sort(${1:v}.begin(), ${1:v}.end(), greater<${2:int}>());",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "sort descending",
            range,
          },
          {
            label: "lower_bound",
            kind: CK.Snippet,
            insertText: "lower_bound(${1:v}.begin(), ${1:v}.end(), ${2:val})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: "upper_bound",
            kind: CK.Snippet,
            insertText: "upper_bound(${1:v}.begin(), ${1:v}.end(), ${2:val})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          // ── using namespace ───────────────────────────────────────
          {
            label: "using namespace std",
            kind: CK.Keyword,
            insertText: "using namespace std;",
            filterText: "using",
            range,
          },
          // ── typedef / using ───────────────────────────────────────
          {
            label: "typedef long long ll",
            kind: CK.Snippet,
            insertText: "typedef long long ll;",
            range,
          },
          {
            label: "typedef pair",
            kind: CK.Snippet,
            insertText: "typedef pair<${1:int}, ${2:int}> ${3:pii};",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          // ── Macros cạnh tranh ─────────────────────────────────────
          {
            label: "pb",
            kind: CK.Snippet,
            insertText: "${1:v}.push_back(${2:val});",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: "push_back",
            range,
          },
          {
            label: "INF",
            kind: CK.Constant,
            insertText: "const int INF = 1e9;",
            documentation: "infinity constant",
            range,
          },
          {
            label: "LLINF",
            kind: CK.Constant,
            insertText: "const long long LLINF = 1e18;",
            range,
          },
          {
            label: "MOD",
            kind: CK.Constant,
            insertText: "const int MOD = 1e9 + 7;",
            range,
          },
        ];

        return { suggestions: snippets };
      },
    });
  });
}
