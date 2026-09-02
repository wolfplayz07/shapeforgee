import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@modelcontextprotocol/ext-apps";
import { ForgeCanvas } from "../../components/forge-canvas";
import { createForgeProject } from "../../lib/shapeforge";
import { acceptRecord, readRecord } from "./state.mjs";

const standalone = window.parent === window;
function Widget() {
  const [record, setRecord] = useState(() => standalone ? { project: createForgeProject("1969 Mustang"), revision: 1, warning: "Preview only — this sample is not saved. Connect the MCP server to work on saved projects." } : null);
  const [selectedId, setSelectedId] = useState(null);
  const [explode, setExplode] = useState(0);
  const [labels, setLabels] = useState(false);
  const [relations, setRelations] = useState(false);
  const [fit, setFit] = useState(0);
  const [reset, setReset] = useState(0);
  const [color, setColor] = useState("#57bff2");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const bridge = useRef(null);
  const activeRecord = useRef(record);
  activeRecord.current = record;
  const selected = record?.project.parts.find(part => part.id === selectedId);
  useEffect(() => { if (selected) setColor(selected.color); }, [selected?.id, selected?.color]);
  useEffect(() => {
    setSelectedId(null); setExplode(0); setError("");
  }, [record?.project.id]);
  useEffect(() => {
    if (standalone) return;
    const app = new App({ name: "ShapeForge assembly viewer", version: "0.1.0" }, {}, { autoResize: true });
    bridge.current = app;
    let alive = true;
    app.ontoolresult = result => {
      if (!alive) return;
      try { const incoming = readRecord(result); setRecord(current => acceptRecord(current, incoming, true)); setError(""); }
      catch (cause) { setError(cause.message); }
    };
    app.connect().then(() => { if (alive) setConnected(true); }).catch(() => { if (alive) setError("Could not connect to the host. Reopen ShapeForge from open_assembly."); });
    return () => { alive = false; bridge.current = null; void app.close(); };
  }, []);
  function select(id) {
    setSelectedId(id);
    if (connected && record) void bridge.current?.updateModelContext({ content: [{ type: "text", text: JSON.stringify({ assembly_id: record.project.id, revision: record.revision, selected_component_id: id, note: "Selection only, not a request to modify the assembly." }) }] }).catch(() => {});
  }
  async function call(name, args) {
    if (!bridge.current || !connected || busy) return;
    setBusy(true); setError("");
    const requestedId = record?.project.id;
    try {
      const result = await bridge.current.callServerTool({ name, arguments: args });
      // A response from a previous assembly must not replace the one now open.
      if (activeRecord.current?.project.id !== requestedId) return;
      const incoming = readRecord(result);
      setRecord(current => acceptRecord(current, incoming));
    } catch (cause) { if (activeRecord.current?.project.id === requestedId) setError(cause.message); }
    finally { setBusy(false); }
  }
  function edit(changes) {
    if (!record || !selected) return;
    void call("update_component", { request_id: crypto.randomUUID(), id: record.project.id, expected_revision: record.revision, component_id: selected.id, changes });
  }
  return <main>
    <header><strong>⬡ SHAPEFORGE</strong><span>{standalone ? "LOCAL PREVIEW" : connected ? "CONNECTED" : "CONNECTING"}</span></header>
    {error && <div role="alert" className="error">{error} {record && connected && <button disabled={busy} onClick={() => void call("get_assembly", { id: record.project.id })}>Refresh assembly</button>}</div>}
    {!record ? <section className="waiting">{error ? "The assembly could not be opened." : "Waiting for a saved assembly…"}<p>Use open_assembly with a saved project ID.</p></section> : <>
      <section className="heading"><div><h1>{record.project.name}</h1><small>{record.project.id} · Revision {record.revision} · {record.project.parts.length} parts</small></div><button disabled={!connected || busy} onClick={() => void call("get_assembly", { id: record.project.id })}>Refresh</button></section>
      <div className="toolbar"><button onClick={() => setFit(value => value + 1)}>Fit</button><button onClick={() => setReset(value => value + 1)}>Reset view</button><label><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)} /> Labels</label><label><input type="checkbox" checked={relations} onChange={event => setRelations(event.target.checked)} /> Relations</label></div>
      <div className="workspace"><div className="viewport"><ForgeCanvas project={record.project} selectedId={selectedId} explode={explode} showLabels={labels} showRelations={relations} fitSignal={fit} resetSignal={reset} onSelect={select} /></div>
      <aside><label htmlFor="component">Component</label><select id="component" value={selectedId || ""} onChange={event => select(event.target.value)}><option value="">Select a component</option>{record.project.parts.map(part => <option key={part.id} value={part.id}>{part.hidden ? "[Hidden] " : ""}{part.name}</option>)}</select>
        {selected ? <><h2>{selected.name}</h2><small>{selected.id}</small><p>{selected.purpose}</p><p className="dimensions">Size: {selected.size.join(" × ")}<br />Position: {selected.position.join(", ")}</p><div className="edit"><label>Color <input aria-label="Component color" type="color" value={color} onChange={event => setColor(event.target.value)} /></label><button disabled={!connected || busy || color === selected.color} onClick={() => edit({ color })}>Save color</button></div><button disabled={!connected || busy} onClick={() => edit({ hidden: !selected.hidden })}>{selected.hidden ? "Show component" : "Hide component"}</button></> : <p>Tap a part in the view or select one above. Drag to orbit; pinch or scroll to zoom.</p>}
        {busy && <p role="status">Saving / loading…</p>}
      </aside></div>
      <section className="explosion"><label htmlFor="explode">Progressive exploded view <output>{explode}%</output></label><input id="explode" type="range" min="0" max="100" value={explode} onChange={event => setExplode(Number(event.target.value))} /><div><span>Assembled</span><span>Subsystems</span><span>Parts</span></div></section>
      <footer>{record.warning}</footer>
    </>}
  </main>;
}
createRoot(document.getElementById("root")).render(<Widget />);
