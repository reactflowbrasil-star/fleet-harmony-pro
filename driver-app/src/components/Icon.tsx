import Svg, { Path, Circle, Line, Polyline, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Base({
  size = 22,
  color = "currentColor",
  strokeWidth = 1.8,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export const MenuIcon = (p: IconProps) => (
  <Base {...p}><Line x1="3" y1="6" x2="21" y2="6" /><Line x1="3" y1="12" x2="21" y2="12" /><Line x1="3" y1="18" x2="21" y2="18" /></Base>
);

export const BellIcon = (p: IconProps) => (
  <Base {...p}><Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path d="M10 21a2 2 0 0 0 4 0" /></Base>
);

export const ChevronRight = (p: IconProps) => (
  <Base {...p}><Polyline points="9 18 15 12 9 6" /></Base>
);

export const ChevronLeft = (p: IconProps) => (
  <Base {...p}><Polyline points="15 18 9 12 15 6" /></Base>
);

export const PlayIcon = (p: IconProps) => (
  <Base {...p}><Path d="M5 4l14 8-14 8z" fill={p.color ?? "currentColor"} stroke="none" /></Base>
);

export const RouteIcon = (p: IconProps) => (
  <Base {...p}><Circle cx="6" cy="19" r="3" /><Path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><Circle cx="18" cy="5" r="3" /></Base>
);

export const FuelIcon = (p: IconProps) => (
  <Base {...p}><Path d="M3 22V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18" /><Line x1="3" y1="22" x2="17" y2="22" /><Path d="M17 5h2a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2h-3" /><Rect x="6" y="6" width="8" height="6" rx="1" /></Base>
);

export const AlertIcon = (p: IconProps) => (
  <Base {...p}><Path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><Line x1="12" y1="9" x2="12" y2="13" /><Line x1="12" y1="17" x2="12.01" y2="17" /></Base>
);

export const FolderIcon = (p: IconProps) => (
  <Base {...p}><Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></Base>
);

export const MapIcon = (p: IconProps) => (
  <Base {...p}><Polyline points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><Line x1="8" y1="2" x2="8" y2="18" /><Line x1="16" y1="6" x2="16" y2="22" /></Base>
);

export const UserIcon = (p: IconProps) => (
  <Base {...p}><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></Base>
);

export const HomeIcon = (p: IconProps) => (
  <Base {...p}><Path d="M3 12 12 3l9 9" /><Path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" /></Base>
);

export const TruckIcon = (p: IconProps) => (
  <Base {...p}><Rect x="1" y="6" width="14" height="11" rx="2" /><Path d="M15 9h4l3 4v4h-7z" /><Circle cx="6" cy="20" r="2" /><Circle cx="18" cy="20" r="2" /></Base>
);

export const EyeIcon = (p: IconProps) => (
  <Base {...p}><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><Circle cx="12" cy="12" r="3" /></Base>
);

export const EyeOffIcon = (p: IconProps) => (
  <Base {...p}><Path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><Path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><Path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" /><Line x1="1" y1="1" x2="23" y2="23" /></Base>
);

export const CameraIcon = (p: IconProps) => (
  <Base {...p}><Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><Circle cx="12" cy="13" r="4" /></Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></Base>
);

export const UploadIcon = (p: IconProps) => (
  <Base {...p}><Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><Polyline points="17 8 12 3 7 8" /><Line x1="12" y1="3" x2="12" y2="15" /></Base>
);

export const MoreVertIcon = (p: IconProps) => (
  <Base {...p}><Circle cx="12" cy="5" r="1" fill={p.color ?? "currentColor"} /><Circle cx="12" cy="12" r="1" fill={p.color ?? "currentColor"} /><Circle cx="12" cy="19" r="1" fill={p.color ?? "currentColor"} /></Base>
);

export const StopIcon = (p: IconProps) => (
  <Base {...p}><Rect x="6" y="6" width="12" height="12" rx="2" fill={p.color ?? "currentColor"} stroke="none" /></Base>
);

export const FileIcon = (p: IconProps) => (
  <Base {...p}><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><Polyline points="14 2 14 8 20 8" /></Base>
);
