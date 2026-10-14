# 3D Digital Twin: IoT Sensors, Heat Auras & Camera Integration Plan
**Factory**: 小瀬 (Oze) Factory *(Extensible to all facilities)*  
**Repository**: `freyaAdmin2` *(with `Kurachi` backend & `ioT` sensors)*  
**Date**: October 2026  
**Status**: Ready for Implementation  

---

## 1. Executive Summary & Objective

The goal of this initiative is to elevate the **小瀬 (Oze) 3D Digital Twin** into a fully interactive spatial monitoring hub by integrating:
1. **Interactive Placement**: Allowing supervisors to click anywhere on the 3D factory floor to place and map IoT temperature/humidity sensors and CCTV cameras.
2. **Dynamic Heat Auras**: Emitting ambient colored floor auras around sensor locations based on live temperature and WBGT (heat stress) readings. When temperatures reach unsafe levels for human workers ($\ge 30^\circ\text{C}$ or $\text{WBGT} \ge 28^\circ\text{C}$), the aura transitions into a pulsing crimson warning zone.
3. **Interactive Camera Feeds**: Placing camera markers on the 3D floor that trigger the existing live HLS camera stream modal (`CameraModal.jsx`) upon click.
4. **Persistent Spatial Configuration**: Saving coordinates to MongoDB with local caching and out-of-the-box default layout coordinates.

---

## 2. Existing System Architecture & Asset Audit

### 2.1 Environmental Sensors (IoT)
* **Firmware (`ioT/tempSensor_ESP32noInk.ino`)**:
  * Hardware: ESP32 + SparkFun HTU21D (temperature & relative humidity).
  * Network: Factory Wi-Fi (`OZEKojo`, `OZEKojo2`).
  * Ingestion Endpoint: `POST https://kurachi.onrender.com/queries` inserting into `submittedDB.tempHumidityDB`.
  * Document Schema:
    ```json
    {
      "工場": "小瀬",
      "Date": "YYYY-MM-DD",
      "Time": "HH:mm:ss",
      "Temperature": "31.20 °C",
      "Humidity": "64.50%",
      "device": "AA:BB:CC:DD:EE:FF",
      "sensorStatus": "OK"
    }
    ```
* **Master Metadata (`Sasaki_Coating_MasterDB.ioTNames`)**:
  * Managed via [`src/services/api.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/services/api.js) (`fetchIoTDeviceNames`, `saveIoTDeviceName`).
  * Maps MAC addresses (`deviceId`) to friendly names (e.g. *"SRS Area Sensor"*), calibration temperature offsets, and reference photos.
* **Worker Safety & Heat Stress Logic**:
  * Defined in [`src/utils/statusHelpers.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/utils/statusHelpers.js):
    * `getTempStatus(temp)`: Normal ($<26^\circ\text{C}$), Warning ($26\text{–}29.9^\circ\text{C}$), Danger ($\ge 30^\circ\text{C}$).
    * `getWBGTStatus(wbgt)`: Calculated via `calcWBGT(T, RH)`. Japan Ministry of the Environment standard: Caution ($21\text{–}25^\circ\text{C}$), Warning ($25\text{–}28^\circ\text{C}$), Severe Warning / Danger ($\ge 28^\circ\text{C}$), Extreme Hazard ($\ge 31^\circ\text{C}$).

### 2.2 Live Factory Cameras
* **Configured Streams (`Kurachi/server.js` & `LiveCameraFeedCard.jsx`)**:
  * `tapo_cam`: **CAM 1 (SRS Line)**
  * `tapo_cam2`: **CAM 2 (Press Line)**
  * `tapo_cam3`: **CAM 3 (Inspection Zone)**
* **Playback Infrastructure**:
  * Backend: MediaMTX HLS stream proxy at `/api/cam?stream=<id>`.
  * Frontend Modal: [`src/components/CameraModal.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/CameraModal.jsx) with `hls.js` support.

### 2.3 3D Factory Twin Foundation
* **Framework**: React Three Fiber (`@react-three/fiber`) + Drei (`@react-three/drei`) + Three.js.
* **Scene File**: [`src/components/twin/FactoryScene.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/FactoryScene.jsx).
* **Layout Definition**: [`src/data/factoryLayouts/kose.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/data/factoryLayouts/kose.js) (Scale: 1 unit = 40px; floor width $\approx 25.25$, depth $\approx 14.375$).
* **Host Component**: [`src/components/panels/TwinPanel.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/panels/TwinPanel.jsx) in [`src/pages/DashboardPage.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/pages/DashboardPage.jsx).

---

## 3. System Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3D Digital Twin Stage                           │
│                      (FactoryScene.jsx in R3F)                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Floor Click    │      │  Sensor Markers  │      │  Camera Markers  │
│  Raycast [x, z]  │      │   + Heat Auras   │      │   3D Pin + FOV   │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Placement Modal │      │ Live Sensor Feed │      │ OnClick Trigger  │
│  Assign Device   │      │ (tempHumidityDB) │      │ CameraModal.jsx  │
└────────┬─────────┘      └──────────────────┘      └──────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│      Persistence Storage         │
│  - MongoDB (ioTNames / Annot.)   │
│  - localStorage (instant sync)   │
│  - kose.js (hardcoded fallbacks) │
└──────────────────────────────────┘
```

---

## 4. Feature Specifications

### 4.1 Feature A: Interactive Click-to-Place Tool
1. **Placement Toolbar**:
   * Add a toolbar button on `TwinPanel` (e.g. `📍 配置モード / Edit Layout`).
   * When activated, a HUD banner shows: *"Click anywhere on the factory floor to place a Sensor or Camera."*
2. **Floor Raycasting**:
   * The `<Floor />` plane in `FactoryScene.jsx` listens for pointer events.
   * On pointer move: Displays a semi-transparent ghost marker tracking the mouse coordinates $[x, 0, z]$.
   * On click: Freezes camera orbit controls and opens the **Placement Modal**.
3. **Placement Modal (`DevicePlacementModal.jsx`)**:
   * **Tab 1: Temperature / Humidity Sensor**:
     * Dropdown of known Oze sensors from `ioTNames` or `fetchSensorData` (shows device MAC + alias).
     * Custom label / zone name (e.g. *"Between OZNC05 & 07"*).
     * Heat aura diffusion radius slider (default: $3.0\text{m}$ world radius).
   * **Tab 2: Camera**:
     * Dropdown of camera streams (`tapo_cam` SRS, `tapo_cam2` Press, `tapo_cam3` Inspection, or custom).
     * Camera orientation slider (heading angle $0\text{–}360^\circ$ for FOV cone).
   * Actions: **Save**, **Reposition**, **Delete**.

### 4.2 Feature B: Dynamic Heat Aura & Worker Safety Thresholds
1. **Floor Aura Visualizer (`SensorHeatAura.jsx`)**:
   * A circular floor mesh (`planeGeometry`) rendered at $y = 0.012$ directly above the floor grid.
   * Material: Additive blending with a procedural soft radial gradient texture (generated via HTML5 Canvas in `twinTextures.js`).
2. **Temperature & WBGT State Mapping**:
   | State | Temperature Range | WBGT Range | Aura Color | Behavior | Worker Safety Meaning |
   | :--- | :--- | :--- | :--- | :--- | :--- |
   | **Normal (Comfortable)** | $< 26.0^\circ\text{C}$ | $< 25.0^\circ\text{C}$ | `#10b981` (Emerald) / `#06b6d4` (Cyan) | Constant soft ambient glow | Safe working environment |
   | **Caution / Warning** | $26.0\text{–}29.9^\circ\text{C}$ | $25.0\text{–}27.9^\circ\text{C}$ | `#f59e0b` (Amber) | Mild breathing pulsation ($0.5\text{Hz}$) | Elevated temperature; hydration alert |
   | **Heat Hazard (Danger)** | $\ge 30.0^\circ\text{C}$ | $\ge 28.0^\circ\text{C}$ | `#ef4444` (Vivid Red) | Rapid expanding pulse ($1.5\text{Hz}$) + outer ring wave | **Unsafe for human workers**: high heatstroke risk |
   | **Extreme Danger** | $\ge 35.0^\circ\text{C}$ | $\ge 31.0^\circ\text{C}$ | `#dc2626` (Deep Crimson) | Intense double-wave pulse | Urgent work stoppage / forced rest break required |
3. **Floating 3D HUD Badge**:
   * Mounted via Drei's `<Html center position={[x, 1.8, z]}>`:
   * Displays sensor title, live temperature (e.g. `31.4°C`), humidity (e.g. `62%`), and WBGT badge (`Danger`).
   * Clicking the badge opens the historical sensor chart drawer or navigates to `/sensors`.

### 4.3 Feature C: Interactive Camera Markers & Live Popup
1. **3D Camera Pin (`CameraMarker.jsx`)**:
   * 3D camera model (sleek CCTV dome/casing with lens and green/red online LED).
   * Subtle semi-transparent directional cone on the floor showing the camera's viewing angle.
   * Floating tag: `📹 CAM 1 (SRS Line)`.
2. **Click Interaction**:
   * Clicking the 3D camera invokes `openCamera('小瀬', streamId)`.
   * Pops open the full [`CameraModal.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/CameraModal.jsx) with zero-latency HLS stream.

---

## 5. Data Schema & Persistence Strategy

### 5.1 Floor Annotation Schema
```typescript
interface FloorAnnotation {
  id: string;                      // Unique ID (e.g. "sensor_oze_01" or "cam_oze_tapo1")
  type: "sensor" | "camera";
  factory: string;                 // "小瀬"
  position: [number, number];      // [x, z] in Three.js world units
  // Sensor-specific fields:
  deviceId?: string;               // Hardware MAC address from tempHumidityDB
  radius?: number;                 // Aura radius in world units (default 3.0)
  // Camera-specific fields:
  streamId?: string;               // "tapo_cam" | "tapo_cam2" | "tapo_cam3"
  rotationY?: number;              // Viewing angle in radians
  label: string;                   // Display name (English/Japanese)
  labelJa?: string;
}
```

### 5.2 Storage Hierarchy (Triple Redundancy)
1. **Tier 1 (Default Layout in Code)**:
   * Pre-seed default sensor & camera locations in [`src/data/factoryLayouts/kose.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/data/factoryLayouts/kose.js) so the 3D scene displays them immediately without any setup.
2. **Tier 2 (Client LocalStorage)**:
   * Key: `freya_factory_annotations_小瀬`.
   * Provides instant updates when dragged or placed, even before server responds.
3. **Tier 3 (MongoDB Persistence)**:
   * Stored in `Sasaki_Coating_MasterDB.ioTNames` (for sensors, extending with `position3D: [x, z]`) and a dedicated collection `factoryFloorAnnotations` for cameras and layout zones.

---

## 6. Implementation Status & Delivery

### Phase 1: Data Model, Storage & Pre-seeded Coordinates — [DONE]
* **Files**:
  * [`src/data/factoryLayouts/kose.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/data/factoryLayouts/kose.js)
  * [`src/data/factoryLayouts/annotations.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/data/factoryLayouts/annotations.js)
  * [`src/hooks/useFactorySensors.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/hooks/useFactorySensors.js)
* **Delivered**:
  1. Default calibrated coordinates for 3 IoT sensors and 3 CCTV streams (`tapo_cam`, `tapo_cam2`, `tapo_cam3`).
  2. LocalStorage persistence (`freya_twin_annotations_<factory>`) with reactive `freya:annotations-changed` event bus.
  3. Live telemetry polling from `submittedDB.tempHumidityDB` with WBGT & worker heat stress danger classification.

### Phase 2: Dynamic Floor Heat Auras & Compact/Detailed Badges — [DONE]
* **Files**:
  * [`src/components/twin/twinTextures.js`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/twinTextures.js)
  * [`src/components/twin/SensorHeatAura.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/SensorHeatAura.jsx)
  * [`src/components/twin/SensorMarker.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/SensorMarker.jsx)
* **Delivered**:
  1. Procedural radial gradient and shockwave ring textures.
  2. Ground heat disc with color transitions: Emerald ($<26^\circ\text{C}$) $\rightarrow$ Amber ($26\text{–}29.9^\circ\text{C}$) $\rightarrow$ Pulsing Crimson Hazard ($\ge 30^\circ\text{C}$ or $\text{WBGT}\ge 28^\circ\text{C}$).
  3. Dual-mode display: Sleek minimal pill or detailed card with one-click `−` collapse and global toolbar visibility toggle so badges never obstruct machine cards.

### Phase 3: 3D In-Scene Camera Surveillance Screen & Stream Modal — [DONE]
* **Files**:
  * [`src/components/twin/CameraMarker.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/CameraMarker.jsx)
  * [`src/components/CameraModal.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/CameraModal.jsx)
* **Delivered**:
  1. Mini 3D surveillance monitor attached directly to the camera mount playing live HLS stream in-scene.
  2. CRT scanline shader overlay, blinking tally LED, directional FOV cone on the floor.
  3. Clicking the 3D monitor expands into the full-screen `CameraModal`.

### Phase 4: Machine 背番号 (Sebanggo) Badge Display — [DONE]
* **Files**:
  * [`src/components/twin/FactoryScene.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/FactoryScene.jsx)
  * [`src/components/twin/twin.css`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/twin.css)
* **Delivered**:
  1. Dedicated `.twin-badge__sebanggo` pill on all machine cards displaying the machine's assigned `背番号` (e.g. `5GD`, `6GD`, `1TD`, `2GL`, `5TN`).

### Phase 5: Interactive Edit Location Mode — [DONE]
* **Files**:
  * [`src/components/panels/TwinPanel.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/panels/TwinPanel.jsx)
  * [`src/components/twin/FactoryScene.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/FactoryScene.jsx)
  * [`src/components/twin/SensorMarker.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/SensorMarker.jsx)
  * [`src/components/twin/CameraMarker.jsx`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/CameraMarker.jsx)
  * [`src/components/twin/twin.css`](file:///Users/karlsome/Documents/GitHub/freyaAdmin2/src/components/twin/twin.css)
* **Delivered**:
  1. **Edit Location Mode Toolbar Toggle**: Amber highlighted button (`edit_location`) activating interactive drag mode with top banner and "Reset Default" / "Done & Save" actions.
  2. **Smooth 3D Floor Raycasting**: Seamless drag-and-drop for both sensors and cameras across the factory floor, with automatic 5cm grid snapping.
  3. **Camera Orientation Control**: Rotate button (`rotate_right`) to increment camera FOV orientation by 45° increments.
  4. **Camera Controls Locking**: Disables Orbit/CameraControls during drag so camera dragging never tilts the 3D scene.
  5. **Instant Persistence**: Automatically commits positions to localStorage on drop.

