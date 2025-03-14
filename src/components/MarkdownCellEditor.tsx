import Editor, { OnMount } from "@monaco-editor/react";
import { ImmutableMarkdownCell } from "@nteract/commutable";
import * as monaco from "monaco-editor";
import { FunctionComponent, useCallback, useEffect, useRef } from "react";

type MarkdownCellEditorProps = {
  cell: ImmutableMarkdownCell;
  onChange: (cell: ImmutableMarkdownCell) => void;
  onShiftEnter: () => void;
  onCtrlEnter: () => void;
  requiresFocus?: boolean;
};

const MarkdownCellEditor: FunctionComponent<MarkdownCellEditorProps> = ({
  cell,
  onChange,
  onShiftEnter,
  onCtrlEnter,
  requiresFocus,
}) => {
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      const newCell = cell.set("source", value);
      onChange(newCell);
    }
  };

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const onShiftEnterRef = useRef(onShiftEnter);
  const onCtrlEnterRef = useRef(onCtrlEnter);

  useEffect(() => {
    onShiftEnterRef.current = onShiftEnter;
    onCtrlEnterRef.current = onCtrlEnter;
  }, [onShiftEnter, onCtrlEnter]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      onShiftEnterRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onCtrlEnterRef.current();
    });

    editor.onKeyDown((event) => {
      if (
        [
          monaco.KeyCode.KeyA,
          monaco.KeyCode.KeyB,
          monaco.KeyCode.KeyX,
        ].includes(event.keyCode)
      ) {
        event.stopPropagation();
      }
    });

    editorRef.current = editor;
  }, []);

  useEffect(() => {
    if (requiresFocus) {
      (async () => {
        const timer = Date.now();
        while (!editorRef.current && Date.now() - timer < 2000) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        editorRef.current?.focus();
      })();
    }
  }, [requiresFocus]);

  return (
    <div style={{ border: "2px solid #e0e0e0", padding: 3 }}>
      <Editor
        height={`${Math.max(1, cell.get("source").split("\n").length) * 20}px`}
        defaultLanguage="markdown"
        value={cell.get("source")}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "off",
          lineDecorationsWidth: 0,
          folding: false,
          fontSize: 14,
          renderLineHighlight: "none",
          theme: "vs",
          wordWrap: "on",
        }}
        onMount={handleEditorMount}
      />
    </div>
  );
};

export default MarkdownCellEditor;
