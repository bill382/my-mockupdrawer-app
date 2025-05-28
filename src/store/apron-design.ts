import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 颜色类型：纯色或印花
export type ColorType = 'solid' | 'pattern'

// 纯色配置
export interface SolidColorConfig {
  type: 'solid'
  colorName: string // 颜色名称
  pantoneCode?: string // 潘通色号（可选）
  hexValue: string // 十六进制颜色值用于预览
}

// 印花配置
export interface PatternConfig {
  type: 'pattern'
  file: File | null // 矢量图案文件
  patternName: string // 图案名称
  repeatMode: 'tile' | 'stretch' | 'center' | 'custom' // 图案重复模式
  // 自定义模式的参数
  customSize?: number // 图案大小百分比 (10-100)
  customPositionX?: number // 水平位置百分比 (0-100)
  customPositionY?: number // 垂直位置百分比 (0-100)
}

// 围裙设计参数（按照指南规范）
export interface ApronDesign {
  // 基础尺寸参数
  topWidth: number // 围裙上沿宽度 (cm)
  bottomWidth: number // 围裙下沿宽度 (cm)
  totalHeight: number // 围裙整体高度 (cm)
  
  // 计算得出的参数（自动计算）
  waistHeight: number // 围裙腰部高度 = 整体高度 × 33%
  bottomHeight: number // 围裙下部高度 = 整体高度 - 腰部高度
  
  // 颜色规格
  colorConfig: SolidColorConfig | PatternConfig
  
  // 绑带参数（使用模板默认值）
  neckStrap: number
  waistStrap: number
}

interface ApronDesignStore {
  design: ApronDesign
  updateDesign: (updates: Partial<Omit<ApronDesign, 'waistHeight' | 'bottomHeight'>>) => void
  updateColorConfig: (colorConfig: SolidColorConfig | PatternConfig) => void
  resetDesign: () => void
  // 计算方法
  calculateDimensions: () => void
  // 临时存储文件（不持久化）
  tempFile: File | null
  setTempFile: (file: File | null) => void
}

const defaultDesign: ApronDesign = {
  topWidth: 45,
  bottomWidth: 60,
  totalHeight: 70,
  waistHeight: 23.1, // 70 × 33% = 23.1
  bottomHeight: 46.9, // 70 - 23.1 = 46.9
  colorConfig: {
    type: 'solid',
    colorName: '珊瑚红',
    hexValue: '#FF6B6B'
  },
  neckStrap: 50,
  waistStrap: 80
}

export const useApronDesignStore = create<ApronDesignStore>()(
  persist(
    (set, get) => ({
      design: defaultDesign,
      tempFile: null,
      
      updateDesign: (updates) =>
        set((state) => {
          const newDesign = { ...state.design, ...updates }
          
          // 自动重新计算尺寸
          if (updates.totalHeight !== undefined) {
            const newWaistHeight = Math.round(newDesign.totalHeight * 0.33 * 10) / 10
            const newBottomHeight = Math.round((newDesign.totalHeight - newWaistHeight) * 10) / 10
            newDesign.waistHeight = newWaistHeight
            newDesign.bottomHeight = newBottomHeight
          }
          
          return { design: newDesign }
        }),
        
      updateColorConfig: (colorConfig) =>
        set((state) => ({
          design: { ...state.design, colorConfig }
        })),
        
      calculateDimensions: () =>
        set((state) => {
          const newWaistHeight = Math.round(state.design.totalHeight * 0.33 * 10) / 10
          const newBottomHeight = Math.round((state.design.totalHeight - newWaistHeight) * 10) / 10
          return {
            design: {
              ...state.design,
              waistHeight: newWaistHeight,
              bottomHeight: newBottomHeight
            }
          }
        }),
        
      setTempFile: (file) =>
        set({ tempFile: file }),
        
      resetDesign: () =>
        set({ design: defaultDesign, tempFile: null })
    }),
    {
      name: 'apron-design-storage-v4', // 更改存储键名以清除旧数据
      partialize: (state) => ({
        design: {
          ...state.design,
          // 排除File对象，因为它们不能被序列化
          colorConfig: state.design.colorConfig.type === 'pattern' 
            ? {
                ...state.design.colorConfig,
                file: null // 不保存文件对象
              }
            : state.design.colorConfig
        }
        // tempFile不会被持久化
      })
    }
  )
) 