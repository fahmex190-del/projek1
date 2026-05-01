import React, { useRef } from "react";
import { X, Image as ImageIcon, Upload } from "lucide-react";
import { compressImage } from "@/app/lib/imageUtils";

type Asset = { id: string; name: string; url: string };

type Props = {
  assets: Asset[];
  onAddAssets: (newAssets: Asset[]) => void;
  onSelect: (url: string) => void;
  onClose: () => void;
};

export default function AssetSelector({
  assets,
  onAddAssets,
  onSelect,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAssets: Asset[] = [];
      for (const file of Array.from(e.target.files)) {
        const url = await compressImage(file, 700000);
        newAssets.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url,
        });
      }
      onAddAssets(newAssets);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#333] shadow-2xl p-4 w-full max-w-lg rounded-xl flex flex-col h-[70vh]">
        <div className="flex justify-between items-center mb-4 text-[#888]">
          <span className="text-xs font-bold uppercase tracking-widest text-white">
            Select Asset
          </span>
          <button onClick={onClose} className="hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="text-xs text-[#aaa]">
            Choose an image to use as sprite.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-[#4a90e2]/20 hover:bg-[#4a90e2]/40 border border-[#4a90e2]/50 text-[#4a90e2] rounded flex items-center text-xs font-bold uppercase"
          >
            <Upload size={14} className="mr-1" /> Upload
          </button>
          <input
            type="file"
            multiple
            accept="image/*"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        <div className="flex-1 overflow-y-auto bg-[#111] border border-[#222] rounded p-2">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#666]">
              <ImageIcon size={32} className="mb-2 opacity-20" />
              <p className="text-xs">No assets uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.url)}
                  className="bg-[#2a2a2a] border border-[#3a3a3a] hover:border-[#4a90e2] rounded overflow-hidden flex flex-col items-center group transition-colors focus:outline-none"
                >
                  <div className="h-20 w-full bg-[#111] flex items-center justify-center relative overflow-hidden">
                    <img
                      src={a.url}
                      alt={a.name}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="p-1 w-full text-center">
                    <p
                      className="text-[9px] text-[#aaa] group-hover:text-white truncate font-mono"
                      title={a.name}
                    >
                      {a.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
