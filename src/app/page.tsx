'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { toast } from 'sonner'
import { Ruler, Palette, Settings, Calculator, FileImage, Download, Package, RefreshCw, Upload, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

import { useApronDesignStore, NECK_STRAP_STYLES } from '../store/apron-design'
import { ApronSVGGenerator } from '../lib/svg-generator'
import { ExportUtils } from '../lib/export-utils'
import type { 
  SolidColorConfig, 
  PatternConfig, 
  PocketMode, 
  PocketConfig, 
  NeckStrapStyle,
  LogoConfig 
} from '../store/apron-design'

export default function ApronDesignGenerator() {
  const { 
    design, 
    updateDesign, 
    updateColorConfig, 
    updateNeckStrapColor, 
    updatePocketColor, 
    updatePocketConfig, 
    updateLogoConfig, 
    resetDesign, 
    tempFile, 
    setTempFile, 
    logoTempFile, 
    setLogoTempFile 
  } = useApronDesignStore()
  
  const [svgContent, setSvgContent] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [colorType, setColorType] = useState<'solid' | 'pattern'>('solid')
  const [previewScale, setPreviewScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [translatePosition, setTranslatePosition] = useState({ x: 0, y: 0 })
  const [isLoaded, setIsLoaded] = useState(false)

  const generatePreview = async () => {
    if (typeof window === 'undefined') return ''
    
    try {
      const generator = new ApronSVGGenerator(design, tempFile, logoTempFile)
      return await generator.generate()
    } catch (error) {
      console.error('SVG生成失败:', error)
      return ''
    }
  }

  useEffect(() => {
    if (design?.colorConfig && design?.neckStrapColor && design?.pocketColor && design?.logoConfig) {
      setIsLoaded(true)
      setColorType(design.colorConfig.type || 'solid')
    }
  }, [design])

  useEffect(() => {
    if (isLoaded && design) {
      generatePreview().then(setSvgContent)
    }
  }, [design, tempFile, logoTempFile, isLoaded])

  const handleSolidColorUpdate = (updates: Partial<SolidColorConfig>) => {
    const currentConfig = design.colorConfig.type === 'solid' 
      ? design.colorConfig as SolidColorConfig 
      : { type: 'solid' as const, colorName: '珊瑚红', hexValue: '#FF6B6B' }
    
    updateColorConfig({ ...currentConfig, ...updates })
  }

  const handlePatternUpdate = (updates: Partial<PatternConfig>) => {
    const currentConfig = design.colorConfig.type === 'pattern' 
      ? design.colorConfig as PatternConfig 
      : { 
          type: 'pattern' as const, 
          file: null, 
          patternName: '自定义图案',
          repeatMode: 'tile' as const
        }
    
    updateColorConfig({ ...currentConfig, ...updates })
  }

  const handleColorTypeChange = (type: 'solid' | 'pattern') => {
    setColorType(type)
    
    if (type === 'solid') {
      updateColorConfig({
        type: 'solid',
        colorName: '珊瑚红',
        hexValue: '#FF6B6B'
      })
    } else {
      updateColorConfig({
        type: 'pattern',
        file: null,
        patternName: '自定义图案',
        repeatMode: 'tile'
      })
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const validTypes = ['image/svg+xml', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        toast.error('请上传SVG、PDF或图片文件')
        return
      }

      setTempFile(file)
      handlePatternUpdate({
        file,
        patternName: file.name.replace(/\.[^/.]+$/, '')
      })
      toast.success('图案文件已上传')
    }
  }

  const handleLogoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const validTypes = ['image/svg+xml', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        toast.error('请上传SVG、PDF或图片文件')
        return
      }

      // 获取图片原始尺寸
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          setLogoTempFile(file)
          updateLogoConfig({
            ...design.logoConfig,
            file,
            logoName: file.name.replace(/\.[^/.]+$/, ''),
            originalWidth: img.width,
            originalHeight: img.height
          })
          URL.revokeObjectURL(url)
          toast.success('LOGO文件已上传')
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          toast.error('无法读取图片文件')
        }
        img.src = url
      } else {
        // SVG 和 PDF 文件直接上传
        setLogoTempFile(file)
        updateLogoConfig({
          ...design.logoConfig,
          file,
          logoName: file.name.replace(/\.[^/.]+$/, ''),
          originalWidth: undefined,
          originalHeight: undefined
        })
        toast.success('LOGO文件已上传')
      }
    }
  }

  const calculateLogoMetrics = () => {
    if (!design.logoConfig.enabled) return null
    
    const { width, offsetX, offsetY } = design.logoConfig
    const apronCenterX = design.bottomWidth / 2 - width / 2
    const realX = apronCenterX + offsetX
    const realY = design.waistHeight / 2 + offsetY
    
    return {
      size: { width, height: width },
      position: { x: realX, y: realY, offsetX, offsetY },
      description: `${width}×${width} cm @ (${realX.toFixed(1)}, ${realY.toFixed(1)}) cm`
    }
  }

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      setTranslatePosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handlePreviewMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => {
    setPreviewScale(prev => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setPreviewScale(prev => Math.max(prev - 0.2, 0.3))
  }

  const resetPreviewTransform = () => {
    setPreviewScale(1)
    setTranslatePosition({ x: 0, y: 0 })
  }

  const handleExportSVG = async () => {
    if (!svgContent) {
      toast.error('请先生成设计稿')
      return
    }
    
    setIsExporting(true)
    try {
      await ExportUtils.exportSVG(svgContent)
      toast.success('SVG文件已下载')
    } catch (error) {
      toast.error('导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPNG = async () => {
    if (!svgContent) {
      toast.error('请先生成设计稿')
      return
    }
    
    setIsExporting(true)
    try {
      await ExportUtils.exportPNG(svgContent)
      toast.success('PNG文件已下载')
    } catch (error) {
      toast.error('PNG导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPackage = async () => {
    if (!svgContent) {
      toast.error('请先生成设计稿')
      return
    }
    
    setIsExporting(true)
    try {
      await ExportUtils.exportDesignPackage(svgContent, design)
      toast.success('设计包已下载')
    } catch (error) {
      toast.error('打包失败')
    } finally {
      setIsExporting(false)
    }
  }

  const handleReset = () => {
    resetDesign()
    setColorType('solid')
    toast.success('设计已重置')
  }

  const handleCenterLogoHorizontally = () => {
    // 计算LOGO水平居中位置：(围裙宽度 - LOGO宽度) / 2
    const apronWidth = design.bottomWidth // 使用围裙下沿宽度作为参考
    const logoWidth = design.logoConfig.width
    const centerOffsetX = Math.max(0, (apronWidth - logoWidth) / 2)
    
    updateLogoConfig({
      ...design.logoConfig,
      offsetX: Number(centerOffsetX.toFixed(1))
    })
    
    toast.success('LOGO已水平居中')
  }

  if (!isLoaded || !design || !design.colorConfig || !design.neckStrapColor || !design.pocketColor || !design.logoConfig) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">正在加载围裙设计器...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧：控制面板（可滚动） */}
      <div className="flex-1 p-4 overflow-y-auto max-h-screen">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">围裙设计工具</h1>
          <p className="text-gray-600">定制您的专属围裙设计</p>
        </div>

        <Tabs defaultValue="dimensions" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dimensions" className="flex items-center gap-1">
              <Ruler className="w-4 h-4" />
              尺寸
            </TabsTrigger>
            <TabsTrigger value="color" className="flex items-center gap-1">
              <Palette className="w-4 h-4" />
              颜色
            </TabsTrigger>
            <TabsTrigger value="style" className="flex items-center gap-1">
              <Settings className="w-4 h-4" />
              样式
            </TabsTrigger>
            <TabsTrigger value="pockets" className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              口袋
            </TabsTrigger>
            <TabsTrigger value="logo" className="flex items-center gap-1">
              <Calculator className="w-4 h-4" />
              LOGO
            </TabsTrigger>
          </TabsList>

          {/* 尺寸设置 */}
          <TabsContent value="dimensions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="w-5 h-5" />
                  围裙尺寸配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="topWidth">上边宽度 (cm)</Label>
                    <Input
                      id="topWidth"
                      type="number"
                      min="20"
                      max="100"
                      value={design.topWidth}
                      onChange={(e) => updateDesign({ topWidth: Number(e.target.value) || 30 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bottomWidth">下边宽度 (cm)</Label>
                    <Input
                      id="bottomWidth"
                      type="number"
                      min="30"
                      max="120"
                      value={design.bottomWidth}
                      onChange={(e) => updateDesign({ bottomWidth: Number(e.target.value) || 60 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="totalHeight">总高度 (cm)</Label>
                    <Input
                      id="totalHeight"
                      type="number"
                      min="40"
                      max="120"
                      value={design.totalHeight}
                      onChange={(e) => updateDesign({ totalHeight: Number(e.target.value) || 70 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="waistHeight">上部高度 (cm)</Label>
                    <Input
                      id="waistHeight"
                      type="number"
                      min="15"
                      max="50"
                      value={design.waistHeight}
                      onChange={(e) => updateDesign({ waistHeight: Number(e.target.value) || 25 })}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      约占总高度的33%
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bottomHeight">下摆高度 (cm)</Label>
                    <Input
                      id="bottomHeight"
                      type="number"
                      min="20"
                      max="80"
                      value={design.bottomHeight}
                      onChange={(e) => updateDesign({ bottomHeight: Number(e.target.value) || 40 })}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      自动计算：总高度 - 上部高度
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 颜色设置 */}
          <TabsContent value="color" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  围裙主体颜色
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-4 mb-4">
                  <Button
                    variant={colorType === 'solid' ? 'default' : 'outline'}
                    onClick={() => setColorType('solid')}
                    className="flex-1"
                  >
                    纯色
                  </Button>
                  <Button
                    variant={colorType === 'pattern' ? 'default' : 'outline'}
                    onClick={() => setColorType('pattern')}
                    className="flex-1"
                  >
                    印花
                  </Button>
                </div>

                {colorType === 'solid' && design.colorConfig.type === 'solid' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="hexValue">颜色值</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="hexValue"
                          value={design.colorConfig.hexValue}
                          onChange={(e) => updateColorConfig({ 
                            ...design.colorConfig, 
                            hexValue: e.target.value 
                          })}
                          placeholder="#FF6B6B"
                        />
                        <input
                          type="color"
                          value={design.colorConfig.hexValue}
                          onChange={(e) => updateColorConfig({ 
                            ...design.colorConfig, 
                            hexValue: e.target.value 
                          })}
                          className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {colorType === 'pattern' && (
                  <div className="space-y-4">
                    <div>
                      <Label>切换到印花模式</Label>
                      <Button 
                        onClick={() => updateColorConfig({
                          type: 'pattern',
                          file: null,
                          patternName: '自定义图案',
                          repeatMode: 'tile'
                        })}
                        className="w-full"
                      >
                        启用印花模式
                      </Button>
                    </div>
                    
                    {design.colorConfig.type === 'pattern' && (
                      <>
                        <div>
                          <Label htmlFor="patternName">图案名称</Label>
                          <Input
                            id="patternName"
                            value={design.colorConfig.patternName}
                            onChange={(e) => updateColorConfig({ 
                              ...design.colorConfig, 
                              patternName: e.target.value 
                            })}
                            placeholder="例如：花朵图案"
                          />
                        </div>
                        
                        <div>
                          <Label>图案文件</Label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                            <input
                              type="file"
                              accept=".svg,.pdf,.png,.jpg,.jpeg"
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) {
                                  setTempFile(file)
                                  updateColorConfig({ 
                                    ...design.colorConfig, 
                                    file,
                                    patternName: file.name.replace(/\.[^/.]+$/, '')
                                  })
                                  toast.success('图案文件已上传')
                                }
                              }}
                              className="hidden"
                              id="pattern-file-upload"
                            />
                            <label htmlFor="pattern-file-upload" className="cursor-pointer">
                              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <div className="text-sm text-gray-600">
                                点击上传图案文件
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                支持 SVG、PDF、PNG、JPG 格式
                              </div>
                            </label>
                          </div>
                          {tempFile && (
                            <div className="mt-2 text-sm text-green-600">
                              已选择文件: {tempFile.name}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 样式设置 */}
          <TabsContent value="style" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  绑带样式设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="neckStrapStyle">颈带样式</Label>
                  <Select
                    value={design.neckStrapStyle}
                    onValueChange={(value: NeckStrapStyle) => updateDesign({ neckStrapStyle: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(NECK_STRAP_STYLES).map(style => (
                        <SelectItem key={style.style} value={style.style}>
                          {style.name} - {style.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="neckStrapColorName">颈带颜色名称</Label>
                  <Input
                    id="neckStrapColorName"
                    value={design.neckStrapColor.colorName}
                    onChange={(e) => updateNeckStrapColor({ 
                      ...design.neckStrapColor, 
                      colorName: e.target.value 
                    })}
                    placeholder="例如：棕色"
                  />
                </div>

                <div>
                  <Label htmlFor="neckStrapHexValue">颈带颜色值</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="neckStrapHexValue"
                      value={design.neckStrapColor.hexValue}
                      onChange={(e) => updateNeckStrapColor({ 
                        ...design.neckStrapColor, 
                        hexValue: e.target.value 
                      })}
                      placeholder="#8B4513"
                    />
                    <input
                      type="color"
                      value={design.neckStrapColor.hexValue}
                      onChange={(e) => updateNeckStrapColor({ 
                        ...design.neckStrapColor, 
                        hexValue: e.target.value 
                      })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 口袋设置 */}
          <TabsContent value="pockets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  口袋配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pocketMode">口袋模式</Label>
                  <Select
                    value={design.pocketConfig.mode}
                    onValueChange={(value: PocketMode) => {
                      const newPocketConfig = { ...design.pocketConfig, mode: value }
                      
                      // 根据选择的模式初始化对应的配置对象
                      if (value === 'single' && !newPocketConfig.singlePocket) {
                        newPocketConfig.singlePocket = {
                          width: 15,
                          height: 12,
                          positionX: 50,
                          positionY: 60
                        }
                      } else if (value === 'double' && !newPocketConfig.doublePockets) {
                        newPocketConfig.doublePockets = {
                          leftPocket: { width: 12, height: 10 },
                          rightPocket: { width: 12, height: 10 },
                          spacing: 5,
                          positionY: 60
                        }
                      } else if (value === 'multiple' && !newPocketConfig.multiplePockets) {
                        newPocketConfig.multiplePockets = {
                          totalWidth: 30,
                          height: 8,
                          count: 3,
                          positionY: 60
                        }
                      }
                      
                      updatePocketConfig(newPocketConfig)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无口袋</SelectItem>
                      <SelectItem value="single">单口袋</SelectItem>
                      <SelectItem value="double">双口袋</SelectItem>
                      <SelectItem value="multiple">多口袋</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {design.pocketConfig.mode !== 'none' && (
                  <>
                    <div>
                      <Label htmlFor="pocketHexValue">口袋颜色值</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="pocketHexValue"
                          value={design.pocketColor.hexValue}
                          onChange={(e) => updatePocketColor({ 
                            ...design.pocketColor, 
                            hexValue: e.target.value 
                          })}
                          placeholder="#D3D3D3"
                        />
                        <input
                          type="color"
                          value={design.pocketColor.hexValue}
                          onChange={(e) => updatePocketColor({ 
                            ...design.pocketColor, 
                            hexValue: e.target.value 
                          })}
                          className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {design.pocketConfig.mode === 'single' && (
                      <div className="bg-blue-50 p-3 rounded">
                        <Label className="text-blue-900 font-medium">单口袋配置</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label className="text-sm">宽度 (cm)</Label>
                            <Input
                              type="number"
                              min="5"
                              max="30"
                              value={design.pocketConfig.singlePocket?.width || 15}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                singlePocket: {
                                  width: Number(e.target.value) || 15,
                                  height: design.pocketConfig.singlePocket?.height || 12,
                                  positionX: design.pocketConfig.singlePocket?.positionX || 50,
                                  positionY: design.pocketConfig.singlePocket?.positionY || 60
                                }
                              })}
                              placeholder="15"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">高度 (cm)</Label>
                            <Input
                              type="number"
                              min="5"
                              max="25"
                              value={design.pocketConfig.singlePocket?.height || 12}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                singlePocket: {
                                  width: design.pocketConfig.singlePocket?.width || 15,
                                  height: Number(e.target.value) || 12,
                                  positionX: design.pocketConfig.singlePocket?.positionX || 50,
                                  positionY: design.pocketConfig.singlePocket?.positionY || 60
                                }
                              })}
                              placeholder="12"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-sm">垂直位置 (%)</Label>
                            <Input
                              type="number"
                              min="20"
                              max="90"
                              value={design.pocketConfig.singlePocket?.positionY || 60}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                singlePocket: {
                                  width: design.pocketConfig.singlePocket?.width || 15,
                                  height: design.pocketConfig.singlePocket?.height || 12,
                                  positionX: design.pocketConfig.singlePocket?.positionX || 50,
                                  positionY: Number(e.target.value) || 60
                                }
                              })}
                              placeholder="60"
                            />
                            <p className="text-xs text-gray-500 mt-1">20%=靠上，90%=靠下</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {design.pocketConfig.mode === 'double' && (
                      <div className="bg-green-50 p-3 rounded">
                        <Label className="text-green-900 font-medium">双口袋配置</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label className="text-sm">左口袋宽度 (cm)</Label>
                            <Input
                              type="number"
                              min="5"
                              max="25"
                              value={design.pocketConfig.doublePockets?.leftPocket?.width || 12}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                doublePockets: {
                                  leftPocket: {
                                    width: Number(e.target.value) || 12,
                                    height: design.pocketConfig.doublePockets?.leftPocket?.height || 10
                                  },
                                  rightPocket: design.pocketConfig.doublePockets?.rightPocket || { width: 12, height: 10 },
                                  spacing: design.pocketConfig.doublePockets?.spacing || 5,
                                  positionY: design.pocketConfig.doublePockets?.positionY || 60
                                }
                              })}
                              placeholder="12"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">右口袋宽度 (cm)</Label>
                            <Input
                              type="number"
                              min="5"
                              max="25"
                              value={design.pocketConfig.doublePockets?.rightPocket?.width || 12}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                doublePockets: {
                                  leftPocket: design.pocketConfig.doublePockets?.leftPocket || { width: 12, height: 10 },
                                  rightPocket: {
                                    width: Number(e.target.value) || 12,
                                    height: design.pocketConfig.doublePockets?.rightPocket?.height || 10
                                  },
                                  spacing: design.pocketConfig.doublePockets?.spacing || 5,
                                  positionY: design.pocketConfig.doublePockets?.positionY || 60
                                }
                              })}
                              placeholder="12"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">口袋高度 (cm)</Label>
                            <Input
                              type="number"
                              min="5"
                              max="20"
                              value={design.pocketConfig.doublePockets?.leftPocket?.height || 10}
                              onChange={(e) => {
                                const newHeight = Number(e.target.value) || 10
                                updatePocketConfig({
                                  ...design.pocketConfig,
                                  doublePockets: {
                                    leftPocket: {
                                      width: design.pocketConfig.doublePockets?.leftPocket?.width || 12,
                                      height: newHeight
                                    },
                                    rightPocket: {
                                      width: design.pocketConfig.doublePockets?.rightPocket?.width || 12,
                                      height: newHeight
                                    },
                                    spacing: design.pocketConfig.doublePockets?.spacing || 5,
                                    positionY: design.pocketConfig.doublePockets?.positionY || 60
                                  }
                                })
                              }}
                              placeholder="10"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">间距 (cm)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="15"
                              value={design.pocketConfig.doublePockets?.spacing || 5}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                doublePockets: {
                                  leftPocket: design.pocketConfig.doublePockets?.leftPocket || { width: 12, height: 10 },
                                  rightPocket: design.pocketConfig.doublePockets?.rightPocket || { width: 12, height: 10 },
                                  spacing: Number(e.target.value) || 0,
                                  positionY: design.pocketConfig.doublePockets?.positionY || 60
                                }
                              })}
                              placeholder="5"
                            />
                            <p className="text-xs text-gray-500 mt-1">0=紧贴，15=最大间距</p>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-sm">垂直位置 (%)</Label>
                            <Input
                              type="number"
                              min="20"
                              max="90"
                              value={design.pocketConfig.doublePockets?.positionY || 60}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                doublePockets: {
                                  leftPocket: design.pocketConfig.doublePockets?.leftPocket || { width: 12, height: 10 },
                                  rightPocket: design.pocketConfig.doublePockets?.rightPocket || { width: 12, height: 10 },
                                  spacing: design.pocketConfig.doublePockets?.spacing || 5,
                                  positionY: Number(e.target.value) || 60
                                }
                              })}
                              placeholder="60"
                            />
                            <p className="text-xs text-gray-500 mt-1">20%=靠上，90%=靠下</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {design.pocketConfig.mode === 'multiple' && (
                      <div className="bg-purple-50 p-3 rounded">
                        <Label className="text-purple-900 font-medium">多口袋配置</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label className="text-sm">口袋数量</Label>
                            <Select 
                              value={String(design.pocketConfig.multiplePockets?.count || 3)}
                              onValueChange={(value) => updatePocketConfig({
                                ...design.pocketConfig,
                                multiplePockets: {
                                  totalWidth: design.pocketConfig.multiplePockets?.totalWidth || 30,
                                  height: design.pocketConfig.multiplePockets?.height || 8,
                                  count: Number(value) || 3,
                                  positionY: design.pocketConfig.multiplePockets?.positionY || 60
                                }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2个口袋</SelectItem>
                                <SelectItem value="3">3个口袋</SelectItem>
                                <SelectItem value="4">4个口袋</SelectItem>
                                <SelectItem value="5">5个口袋</SelectItem>
                                <SelectItem value="6">6个口袋</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">总宽度 (cm)</Label>
                            <Input
                              type="number"
                              min="15"
                              max="50"
                              value={design.pocketConfig.multiplePockets?.totalWidth || 30}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                multiplePockets: {
                                  totalWidth: Number(e.target.value) || 30,
                                  height: design.pocketConfig.multiplePockets?.height || 8,
                                  count: design.pocketConfig.multiplePockets?.count || 3,
                                  positionY: design.pocketConfig.multiplePockets?.positionY || 60
                                }
                              })}
                              placeholder="30"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">口袋高度 (cm)</Label>
                            <Input
                              type="number"
                              min="5"
                              max="15"
                              value={design.pocketConfig.multiplePockets?.height || 8}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                multiplePockets: {
                                  totalWidth: design.pocketConfig.multiplePockets?.totalWidth || 30,
                                  height: Number(e.target.value) || 8,
                                  count: design.pocketConfig.multiplePockets?.count || 3,
                                  positionY: design.pocketConfig.multiplePockets?.positionY || 60
                                }
                              })}
                              placeholder="8"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">垂直位置 (%)</Label>
                            <Input
                              type="number"
                              min="20"
                              max="90"
                              value={design.pocketConfig.multiplePockets?.positionY || 60}
                              onChange={(e) => updatePocketConfig({
                                ...design.pocketConfig,
                                multiplePockets: {
                                  totalWidth: design.pocketConfig.multiplePockets?.totalWidth || 30,
                                  height: design.pocketConfig.multiplePockets?.height || 8,
                                  count: design.pocketConfig.multiplePockets?.count || 3,
                                  positionY: Number(e.target.value) || 60
                                }
                              })}
                              placeholder="60"
                            />
                            <p className="text-xs text-gray-500 mt-1">20%=靠上，90%=靠下</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOGO印刷设置 */}
          <TabsContent value="logo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  LOGO印刷配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="logoEnabled"
                    checked={design.logoConfig.enabled}
                    onChange={(e) => updateLogoConfig({
                      ...design.logoConfig,
                      enabled: e.target.checked
                    })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="logoEnabled" className="text-sm font-medium">
                    启用LOGO印刷
                  </Label>
                </div>

                {design.logoConfig.enabled && (
                  <>
                    <div>
                      <Label htmlFor="logoName">LOGO名称</Label>
                      <Input
                        id="logoName"
                        value={design.logoConfig.logoName}
                        onChange={(e) => updateLogoConfig({
                          ...design.logoConfig,
                          logoName: e.target.value
                        })}
                        placeholder="自定义LOGO"
                      />
                    </div>

                    <div>
                      <Label htmlFor="logoFile">LOGO文件上传</Label>
                      <div className="mt-1">
                        <input
                          type="file"
                          id="logoFile"
                          accept=".svg,.png,.jpg,.jpeg,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setLogoTempFile(file)
                              updateLogoConfig({
                                ...design.logoConfig,
                                file: file
                              })
                            }
                          }}
                          className="block w-full text-sm text-gray-500
                                     file:mr-4 file:py-2 file:px-4
                                     file:rounded-md file:border-0
                                     file:text-sm file:font-semibold
                                     file:bg-blue-50 file:text-blue-700
                                     hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          支持 SVG、PNG、JPG、PDF 格式
                        </p>
                        {(logoTempFile || design.logoConfig.file) && (
                          <p className="text-xs text-green-600 mt-1">
                            已选择: {(logoTempFile || design.logoConfig.file)?.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded">
                      <Label className="text-yellow-900 font-medium">LOGO尺寸配置</Label>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <Label className="text-sm">宽度 (cm)</Label>
                          <Input
                            type="number"
                            min="2"
                            max="20"
                            step="0.5"
                            value={design.logoConfig.width}
                            onChange={(e) => updateLogoConfig({
                              ...design.logoConfig,
                              width: Number(e.target.value) || 8
                            })}
                            placeholder="8"
                          />
                        </div>

                      </div>
                    </div>

                    <div className="bg-green-50 p-3 rounded">
                      <Label className="text-green-900 font-medium">LOGO位置配置</Label>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <Label className="text-sm">水平偏移 (cm)</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="40"
                              step="0.5"
                              value={design.logoConfig.offsetX}
                              onChange={(e) => updateLogoConfig({
                                ...design.logoConfig,
                                offsetX: Number(e.target.value) || 15
                              })}
                              placeholder="15"
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCenterLogoHorizontally}
                              className="px-2 py-1 text-xs"
                              title="水平居中"
                            >
                              居中
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">从左边边缘算起</p>
                        </div>
                        <div>
                          <Label className="text-sm">垂直偏移 (cm)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={design.logoConfig.offsetY}
                            onChange={(e) => updateLogoConfig({
                              ...design.logoConfig,
                              offsetY: Number(e.target.value) || 12
                            })}
                            placeholder="12"
                          />
                          <p className="text-xs text-gray-500 mt-1">从顶部边缘算起</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-3 rounded">
                      <Label className="text-purple-900 font-medium">LOGO透明度</Label>
                      <div className="mt-2">
                        <Input
                          type="range"
                          min="10"
                          max="100"
                          step="5"
                          value={design.logoConfig.opacity}
                          onChange={(e) => updateLogoConfig({
                            ...design.logoConfig,
                            opacity: Number(e.target.value)
                          })}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>透明 (10%)</span>
                          <span className="font-medium">{design.logoConfig.opacity}%</span>
                          <span>不透明 (100%)</span>
                        </div>
                      </div>
                    </div>


                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2 mt-6">
          <Button onClick={handleExportSVG} disabled={isExporting || !svgContent}>
            <Download className="w-4 h-4 mr-2" />
            导出SVG
          </Button>
          <Button onClick={handleExportPNG} disabled={isExporting || !svgContent}>
            <Download className="w-4 h-4 mr-2" />
            导出PNG
          </Button>
          <Button onClick={handleExportPackage} disabled={isExporting || !svgContent}>
            <Package className="w-4 h-4 mr-2" />
            导出设计包
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            重置设计
          </Button>
        </div>
      </div>

      {/* 右侧：预览区域（更宽的显示区域） */}
      <div className="w-1/2 bg-white border-l border-gray-200 p-4 overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">实时预览</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={previewScale <= 0.3}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-500 min-w-12 text-center">
              {Math.round(previewScale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={previewScale >= 3}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetPreviewTransform}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div 
          className="bg-gray-50 rounded-lg overflow-hidden cursor-move select-none"
          style={{ height: 'calc(100vh - 180px)' }}
          onMouseDown={handlePreviewMouseDown}
          onMouseMove={handlePreviewMouseMove}
          onMouseUp={handlePreviewMouseUp}
          onMouseLeave={handlePreviewMouseUp}
        >
          {svgContent ? (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ 
                transform: `scale(${previewScale}) translate(${translatePosition.x}px, ${translatePosition.y}px)`,
                transformOrigin: 'center'
              }}
            >
              <div 
                dangerouslySetInnerHTML={{ __html: svgContent }}
                className="max-w-full max-h-full"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calculator className="w-12 h-12 mx-auto mb-4" />
                <p>生成预览中...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 