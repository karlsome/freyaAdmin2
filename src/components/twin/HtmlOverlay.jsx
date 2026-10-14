import { forwardRef, useLayoutEffect, useMemo, useRef } from "react";
import * as ReactDOM from "react-dom/client";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";

const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();

function defaultCalculatePosition(el, camera, size) {
  const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
  objectPos.project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [objectPos.x * widthHalf + widthHalf, -(objectPos.y * heightHalf) + heightHalf];
}

function isObjectBehindCamera(el, camera) {
  const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
  const cameraPos = v2.setFromMatrixPosition(camera.matrixWorld);
  const deltaCamObj = objectPos.sub(cameraPos);
  const camDir = camera.getWorldDirection(v3);
  return deltaCamObj.angleTo(camDir) > Math.PI / 2;
}

function objectScale(el, camera) {
  if (camera instanceof OrthographicCamera) {
    return camera.zoom;
  }
  if (camera instanceof PerspectiveCamera) {
    const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
    const cameraPos = v2.setFromMatrixPosition(camera.matrixWorld);
    const vFOV = (camera.fov * Math.PI) / 180;
    const dist = objectPos.distanceTo(cameraPos);
    const scaleFOV = 2 * Math.tan(vFOV / 2) * dist;
    return 1 / scaleFOV;
  }
  return 1;
}

function objectZIndex(el, camera, zIndexRange) {
  if (camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera) {
    const objectPos = v1.setFromMatrixPosition(el.matrixWorld);
    const cameraPos = v2.setFromMatrixPosition(camera.matrixWorld);
    const dist = objectPos.distanceTo(cameraPos);
    const A = (zIndexRange[1] - zIndexRange[0]) / (camera.far - camera.near);
    const B = zIndexRange[1] - A * camera.far;
    return Math.round(A * dist + B);
  }
  return undefined;
}

/**
 * Lightweight 3D-to-DOM overlay replacement for @react-three/drei's <Html>.
 * - Uses a stable DOM parent (`gl.domElement.parentNode`) so roots don't remount when R3F connects events.
 * - Creates a dedicated DOM container per effect lifecycle and defers `root.unmount()` to a macrotask
 *   so React 19 never warns about synchronous root unmounts during render.
 */
export const Html = forwardRef(function Html(
  {
    children,
    eps = 0.001,
    style,
    className,
    prepend,
    center,
    fullscreen,
    portal,
    distanceFactor,
    zIndexRange = [16777271, 0],
    calculatePosition = defaultCalculatePosition,
    as = "div",
    wrapperClass,
    ...props
  },
  ref
) {
  const { gl, camera, scene, size } = useThree();
  const elRef = useRef(null);
  const rootRef = useRef(null);
  const groupRef = useRef(null);
  const oldZoom = useRef(0);
  const oldPosition = useRef([0, 0]);
  const visible = useRef(true);

  const target = portal?.current || gl.domElement.parentNode;

  useLayoutEffect(() => {
    if (!groupRef.current || !target) return undefined;

    const container = document.createElement(as);
    if (wrapperClass) container.className = wrapperClass;
    const currentRoot = ReactDOM.createRoot(container);
    elRef.current = container;
    rootRef.current = currentRoot;

    scene.updateMatrixWorld();
    const vec = calculatePosition(groupRef.current, camera, size);
    container.style.cssText = `position:absolute;top:0;left:0;transform:translate3d(${vec[0]}px,${vec[1]}px,0);transform-origin:0 0;`;

    if (prepend) target.prepend(container);
    else target.appendChild(container);

    return () => {
      if (rootRef.current === currentRoot) rootRef.current = null;
      if (elRef.current === container) elRef.current = null;
      container.style.display = "none";
      setTimeout(() => {
        try {
          currentRoot.unmount();
        } catch {
          // ignore
        }
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }, 0);
    };
  }, [target, prepend, as]);

  useLayoutEffect(() => {
    if (elRef.current && wrapperClass !== undefined) {
      elRef.current.className = wrapperClass || "";
    }
  }, [wrapperClass]);

  const styles = useMemo(
    () => ({
      position: "absolute",
      transform: center ? "translate3d(-50%,-50%,0)" : "none",
      ...(fullscreen && {
        top: -size.height / 2,
        left: -size.width / 2,
        width: size.width,
        height: size.height,
      }),
      ...style,
    }),
    [style, center, fullscreen, size]
  );

  useLayoutEffect(() => {
    rootRef.current?.render(
      <div ref={ref} style={styles} className={className}>
        {children}
      </div>
    );
  });

  useFrame(() => {
    const el = elRef.current;
    if (!groupRef.current || !el) return;
    camera.updateMatrixWorld();
    groupRef.current.updateWorldMatrix(true, false);
    const vec = calculatePosition(groupRef.current, camera, size);

    if (
      Math.abs(oldZoom.current - camera.zoom) > eps ||
      Math.abs(oldPosition.current[0] - vec[0]) > eps ||
      Math.abs(oldPosition.current[1] - vec[1]) > eps
    ) {
      const isBehindCamera = isObjectBehindCamera(groupRef.current, camera);
      const nextVisible = !isBehindCamera;
      if (visible.current !== nextVisible) {
        visible.current = nextVisible;
        el.style.display = nextVisible ? "block" : "none";
      }
      el.style.zIndex = `${objectZIndex(groupRef.current, camera, zIndexRange)}`;
      const scale = distanceFactor === undefined ? 1 : objectScale(groupRef.current, camera) * distanceFactor;
      el.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0) scale(${scale})`;
      oldPosition.current = vec;
      oldZoom.current = camera.zoom;
    }
  });

  return <group {...props} ref={groupRef} />;
});

export default Html;

