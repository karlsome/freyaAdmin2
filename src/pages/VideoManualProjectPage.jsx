import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Edit, Canvas, Controls, Timeline, UIController } from "@shotstack/shotstack-studio";
import {
  fetchVideoManualProject,
  patchVideoManualProject,
  createVideoManualRevision,
} from "../services/videoManualApi";

export default function VideoManualProjectPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Editor UI State
  const [activeRightTab, setActiveRightTab] = useState("Shapes");
  const rightTabs = [
    { id: "Text", icon: "text_fields" },
    { id: "Shapes", icon: "category" },
    { id: "Media", icon: "video_library" },
    { id: "Anim", icon: "show_chart" },
    { id: "Background", icon: "palette" },
    { id: "Advanced", icon: "settings" },
  ];

  // Refs for the SDK instances and DOM mount points
  const editRef = useRef(null);
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const studioElRef = useRef(null);
  const timelineElRef = useRef(null);
  const sdkInitialized = useRef(false);

  // Load project metadata
  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoadingProject(true);
      setProjectError("");
      try {
        const nextProject = await fetchVideoManualProject(projectId);
        if (!cancelled) setProject(nextProject);
      } catch (err) {
        if (!cancelled) {
          setProject(null);
          setProjectError(err.message || "Failed to load project.");
        }
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    }

    loadProject();
    return () => { cancelled = true; };
  }, [projectId]);

  // Mount the Shotstack SDK
  useEffect(() => {
    if (!project || sdkInitialized.current) return;
    if (!studioElRef.current || !timelineElRef.current) return;

    sdkInitialized.current = true;

    const template = project.edit || { timeline: { tracks: [] } };

    let cancelled = false;
    let edit;
    let canvas;
    let timeline;
    let controls;

    function disposeSDK() {
      try { canvas?.dispose(); } catch (_) {}
      try { edit?.dispose(); } catch (_) {}
    }

    async function initSDK() {
      try {
        edit = new Edit(template);
        canvas = new Canvas(edit);
        
        // Render UI Controller so strict requirements are met, but without any buttons
        const ui = UIController.create(edit, canvas);

        await canvas.load();
        if (cancelled) { disposeSDK(); return; }

        await edit.load();
        if (cancelled) { disposeSDK(); return; }

        timeline = new Timeline(edit, timelineElRef.current);
        await timeline.load();
        if (cancelled) { disposeSDK(); return; }

        controls = new Controls(edit);
        await controls.load();
        if (cancelled) { disposeSDK(); return; }

        edit.play();

        editRef.current = edit;
        canvasRef.current = canvas;
        timelineRef.current = timeline;
      } catch (err) {
        disposeSDK();
        if (!cancelled) {
          console.error("Shotstack SDK init failed:", err);
          setProjectError("Failed to initialize the editor: " + (err.message || "unknown error"));
        }
      }
    }

    initSDK();

    return () => {
      cancelled = true;
      sdkInitialized.current = false;
      if (editRef.current) {
        try { canvasRef.current?.dispose(); } catch (_) {}
        try { editRef.current?.dispose(); } catch (_) {}
        editRef.current = null;
        canvasRef.current = null;
        timelineRef.current = null;
      }
    };
  }, [project]);

  const handleSave = useCallback(async () => {
    if (!editRef.current || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const currentEdit = editRef.current.getEdit();
      await patchVideoManualProject(projectId, { edit: currentEdit });
      setSaveSuccess("Saved successfully.");
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch (err) {
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [projectId, saving]);

  const handleSaveRevision = useCallback(async () => {
    if (!editRef.current || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const currentEdit = editRef.current.getEdit();
      await patchVideoManualProject(projectId, { edit: currentEdit });
      const { revisionNumber } = await createVideoManualRevision(projectId, currentEdit);
      setSaveSuccess(`Revision ${revisionNumber} created.`);
      const refreshed = await fetchVideoManualProject(projectId);
      setProject(refreshed);
      setTimeout(() => setSaveSuccess(""), 4000);
    } catch (err) {
      setSaveError(err.message || "Revision save failed.");
    } finally {
      setSaving(false);
    }
  }, [projectId, saving]);

  // Insert actions replacing Shotstack UI module
  const handleAddText = () => {
    if (!editRef.current) return;
    editRef.current.addTrack(0, {
      clips: [{
        asset: {
          type: "rich-text",
          text: "Change Text",
          font: { family: "Work Sans", size: 48, weight: 600, color: "#ffffff", opacity: 1 },
          align: { horizontal: "center", vertical: "middle" }
        },
        start: editRef.current.player?.currentTime || 0,
        length: 5,
        width: 500,
        height: 200
      }]
    });
  };

  const handleAddShape = (shapeType) => {
    if (!editRef.current) return;
    editRef.current.addTrack(0, {
      clips: [{
        asset: {
          type: "shape",
          shape: shapeType,
          width: 200,
          height: 200,
          rectangle: shapeType === 'rectangle' ? { width: 200, height: 200 } : undefined,
          fill: { color: "#ffffff", opacity: 0.5 }
        },
        start: editRef.current.player?.currentTime || 0,
        length: 5,
        width: 200,
        height: 200
      }]
    });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f4f6f8] font-sans">
      
      {/* 1. Header (Legacy style match) */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 text-sm z-10 shadow-sm relative">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/videoManual")}
            className="flex items-center gap-1 rounded bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Projects
          </button>
          
          <div className="mx-2 h-6 w-px bg-gray-300"></div>
          
          {/* Undo / Redo controls */}
          <button className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100">
            <span className="material-symbols-outlined text-[18px]">undo</span>
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100">
            <span className="material-symbols-outlined text-[18px]">redo</span>
          </button>
          
          <div className="mx-2 h-6 w-px bg-gray-300"></div>
          
          <button onClick={handleSaveRevision} disabled={saving} className="flex items-center gap-1 rounded bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200">
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save Revision
          </button>
          
          <button className="flex items-center gap-1 rounded bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200">
            <span className="material-symbols-outlined text-[16px]">history</span>
            History
          </button>
        </div>

        {/* Center Title */}
        <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span className="font-bold text-gray-900">{project?.title || "Project"}</span>
          <span className="text-[10px] text-gray-500">Project loaded</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded border border-gray-300 bg-white">
            <button className="px-2 py-1 text-gray-600 hover:bg-gray-100">
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <div className="border-x border-gray-300 px-3 py-1 text-sm text-gray-700">
              Auto-Fit Page
            </div>
            <button className="px-2 py-1 text-gray-600 hover:bg-gray-100">
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="flex items-center gap-1 rounded bg-[#3c82f6] px-4 py-1.5 text-white hover:bg-blue-600"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export
          </button>
        </div>
      </header>
      
      {/* Messages */}
      {(projectError || saveError || saveSuccess) && (
        <div className={`flex justify-center p-1 text-xs font-semibold text-white ${projectError || saveError ? 'bg-red-500' : 'bg-green-500'}`}>
          {projectError || saveError || saveSuccess}
        </div>
      )}

      {/* Main Workspace Frame */}
      {loadingProject ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-[32px] text-gray-400">progress_activity</span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col relative w-full">
          
          {/* Top content: Left Sidebar + Central Canvas + Right Sidebar */}
          <div className="flex flex-1 min-h-0 relative">
            
            {/* 2. Left Sidebar (STEPS) */}
            <aside className="w-[180px] sm:w-[220px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col z-10">
              <div className="flex items-center justify-between border-b border-gray-100 p-3">
                <span className="text-xs font-bold tracking-widest text-gray-500">STEPS</span>
                <span className="text-xs text-gray-400">1</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {/* Mock Step Card */}
                <div className="flex flex-col gap-1 rounded-md border border-blue-100 bg-[#f4f8ff] p-3 shadow-sm select-none cursor-pointer relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-blue-500 text-[10px] font-bold text-white">1</span>
                    <span className="text-sm font-semibold text-gray-800">Step 1</span>
                  </div>
                  <span className="text-xs text-gray-500 pl-7">0:00.0 - 0:07.7</span>
                  <span className="text-[10px] text-gray-400 pl-7 italic mt-1 group-hover:text-blue-500">Add description...</span>
                </div>
              </div>
              <div className="border-t border-gray-100 p-2">
                 <button className="flex w-full items-center justify-center gap-1 rounded bg-gray-100 p-2 text-sm text-gray-600 hover:bg-gray-200">
                    <span className="material-symbols-outlined text-[16px]">add</span> Add Step
                 </button>
              </div>
            </aside>

            {/* 3. Center Canvas Video wrapper */}
            <main className="flex-1 relative flex flex-col items-center justify-center bg-gray-100 p-4 min-w-0">
               <div 
                 ref={studioElRef} 
                 data-shotstack-studio
                 className="w-full h-full max-w-[900px] border border-black/5 bg-black shadow-lg rounded overflow-hidden" 
               />
               <style dangerouslySetInnerHTML={{__html: `
                 .shotstack-ui { display: none !important; }
               `}} />
            </main>

            {/* 4. Right Sidebar Area */}
            <div className="flex justify-end relative h-full flex-shrink-0 z-10 isolate">
              
              {/* Expandable Options Panel */}
              <div className="h-full border-l border-gray-200 bg-white" style={{ display: activeRightTab ? 'block' : 'none', width: '260px' }}>
                <div className="border-b border-gray-100 px-4 py-3">
                  <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">{activeRightTab}</span>
                </div>
                
                <div className="p-4">
                  {/* Dynamic Panel Content based on selected tab */}
                  {activeRightTab === 'Text' && (
                     <div className="flex flex-col gap-3">
                        <span className="text-sm text-gray-600 font-medium border-b pb-1">Text Tools</span>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleAddText} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-300">
                                <span className="material-symbols-outlined text-[32px] font-light">text_fields</span>
                                <span className="text-sm font-semibold">Heading</span>
                            </button>
                        </div>
                     </div>
                  )}

                  {activeRightTab === 'Shapes' && (
                    <div className="flex flex-col gap-3">
                        <span className="text-sm text-gray-600 font-medium border-b pb-1">Shape Tools</span>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleAddShape('rectangle')} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-blue-300 transition-colors">
                                <span className="material-symbols-outlined text-[32px] font-light">crop_5_4</span>
                                <span className="text-sm font-semibold">Rectangle</span>
                            </button>
                            <button onClick={() => handleAddShape('ellipse')} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-blue-300 transition-colors">
                                <span className="material-symbols-outlined text-[32px] font-light">circle</span>
                                <span className="text-sm font-semibold">Circle</span>
                            </button>
                            <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-blue-300 transition-colors">
                                <span className="material-symbols-outlined text-[32px] font-light">call_made</span>
                                <span className="text-sm font-semibold">Arrow</span>
                            </button>
                            <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-blue-300 transition-colors">
                                <span className="material-symbols-outlined text-[32px] font-light">horizontal_rule</span>
                                <span className="text-sm font-semibold">Line</span>
                            </button>
                        </div>
                    </div>
                  )}

                  {activeRightTab === 'Media' && (
                    <div className="flex flex-col gap-3 items-center justify-center p-6 text-gray-400">
                        <span className="material-symbols-outlined text-[48px]">video_library</span>
                        <span className="text-sm text-center">Media library integration goes here.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool Icons Column */}
              <div className="w-[84px] bg-white border-l border-gray-200 flex flex-col items-center pt-2">
                 <div className="px-2 pb-2 mb-2 w-full text-center border-b border-gray-100">
                    <span className="text-[10px] font-bold tracking-widest text-gray-500">ADD</span>
                 </div>
                 
                 {rightTabs.map(tab => {
                   const isActive = activeRightTab === tab.id;
                   return (
                     <button
                       key={tab.id}
                       onClick={() => setActiveRightTab(tab.id)}
                       className={`flex flex-col items-center justify-center w-[60px] h-[64px] mb-2 rounded-2xl transition-colors ${
                         isActive 
                           ? 'bg-[#06b6d4] text-white shadow-md' 
                           : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                       }`}
                     >
                       <span className={`material-symbols-outlined ${isActive ? 'filled' : ''} text-[24px]`}>
                         {tab.icon}
                       </span>
                       <span className={`text-[10px] mt-1 ${isActive ? 'font-medium' : 'font-medium opacity-80'}`}>
                         {tab.id}
                       </span>
                     </button>
                   );
                 })}
              </div>
            </div>

          </div>

          {/* 5. Bottom Timeline */}
          <div className="h-[280px] w-full flex-shrink-0 border-t border-gray-200 bg-white relative z-20">
              <div 
                ref={timelineElRef}
                data-shotstack-timeline
                className="w-full h-full"
              />
          </div>

        </div>
      )}
    </div>
  );
}
