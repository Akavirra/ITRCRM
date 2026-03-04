import { motion } from "motion/react";
import { Cpu, CodeXml, Palette, Blocks, Pencil, Video } from "lucide-react";

interface LoadingOverlayProps {
  isVisible: boolean;
}

const icons = [
  { Icon: Cpu, color: "text-blue-500", delay: 0 },
  { Icon: CodeXml, color: "text-yellow-400", delay: 0.1 },
  { Icon: Palette, color: "text-blue-500", delay: 0.2 },
  { Icon: Blocks, color: "text-yellow-400", delay: 0.3 },
  { Icon: Pencil, color: "text-blue-500", delay: 0.4 },
  { Icon: Video, color: "text-yellow-400", delay: 0.5 },
];

export const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  if (!isVisible) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="relative flex flex-col items-center">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute w-48 h-48 border-2 border-blue-500 rounded-full" />
        <div className="grid grid-cols-3 gap-8 relative z-10">
          {icons.map(({ Icon, color, delay }, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, rotate: [0, 5, -5, 0] }} transition={{ opacity: { delay }, y: { delay }, rotate: { duration: 4, repeat: Infinity, delay: delay + 0.5 } }} className={`p-4 rounded-2xl bg-white shadow-sm border border-gray-50 flex items-center justify-center ${color}`}>
              <Icon size={32} strokeWidth={1.5} />
            </motion.div>
          ))}
        </div>
        <div className="mt-12 w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
          <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="w-full h-full bg-gradient-to-r from-blue-500 via-yellow-400 to-blue-500" />
        </div>
      </div>
    </motion.div>
  );
};
