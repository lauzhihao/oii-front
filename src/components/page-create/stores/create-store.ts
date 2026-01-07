import { create } from 'zustand';

interface CreateStore {
    // 聊天Sheet开关状态
    isChatOpen: boolean;
    setChatOpen: (open: boolean) => void;
    toggleChat: () => void;
}

export const useCreateStore = create<CreateStore>((set) => ({
    isChatOpen: false,
    setChatOpen: (open) => set({ isChatOpen: open }),
    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
}));
