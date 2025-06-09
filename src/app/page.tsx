'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useApronDesignStore } from '@/store/apron-design'
import type { SolidColorConfig, PatternConfig, NeckStrapStyle, PocketConfig, PocketMode, LogoConfig } from '@/store/apron-design'
import { NECK_STRAP_STYLES } from '@/store/apron-design'
import { ApronSVGGenerator } from '@/lib/svg-generator'
import { ExportUtils } from '@/lib/export-utils'
import { 
	ChevronDown, 
	Download, 
	FileImage, 
	Package, 
	RefreshCw, 
	Palette,
	Upload,
	Calculator,
	Ruler,
	Settings,
	Target,
	ZoomIn,
	ZoomOut,
	RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * @description 这只是个示例页面，你可以随意修改这个页面或进行全面重构
 */
export default function ApronDesignGenerator() {
	const { design, updateDesign, updateColorConfig, updateNeckStrapColor, updatePocketColor, updatePocketConfig, updateLogoConfig, resetDesign, tempFile, setTempFile, logoTempFile, setLogoTempFile } = useApronDesignStore()
	const [svgContent, setSvgContent] = useState('')
	const [isExporting, setIsExporting] = useState(false)
	const [colorType, setColorType] = useState<'solid' | 'pattern'>('solid')
	const [previewScale, setPreviewScale] = useState(1) // 预览图缩放比例
	
	// 拖拽相关状态
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
	const [translatePosition, setTranslatePosition] = useState({ x: 0, y: 0 })

	// 添加加载状态检查，确保设计数据完全加载
	const [isLoaded, setIsLoaded] = useState(false)

	// 生成SVG预览
	const generatePreview = async () => {
		// 只在客户端生成SVG
		if (typeof window === 'undefined') {
			return ''
		}
		
		try {
			const generator = new ApronSVGGenerator(design, tempFile, logoTempFile)
			return await generator.generate()
		} catch (error) {
			console.error('SVG生成失败:', error)
			return ''
		}
	}

	useEffect(() => {
		// 检查设计数据是否完全加载
		if (design && design.colorConfig && design.neckStrapColor && design.pocketColor && design.logoConfig) {
			setIsLoaded(true)
			setColorType(design.colorConfig.type || 'solid')
		}
	}, [design])

	useEffect(() => {
		if (isLoaded && design) {
			generatePreview().then(setSvgContent)
		}
	}, [design, tempFile, logoTempFile, isLoaded])

	// 如果数据还没加载完成，显示加载界面
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

	// 处理纯色配置更新
	const handleSolidColorUpdate = (updates: Partial<SolidColorConfig>) => {
		const currentConfig = design.colorConfig.type === 'solid' 
			? design.colorConfig as SolidColorConfig 
			: { type: 'solid' as const, colorName: '珊瑚红', hexValue: '#FF6B6B' }
		
		updateColorConfig({
			...currentConfig,
			...updates
		})
	}

	// 处理印花配置更新
	const handlePatternUpdate = (updates: Partial<PatternConfig>) => {
		const currentConfig = design.colorConfig.type === 'pattern' 
			? design.colorConfig as PatternConfig 
			: { 
					type: 'pattern' as const, 
					file: null, 
					patternName: '自定义图案',
					repeatMode: 'tile' as const
				}
		
		updateColorConfig({
			...currentConfig,
			...updates
		})
	}

	// 处理颜色类型切换
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

	// 处理文件上传
	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			// 验证文件类型
			const validTypes = ['image/svg+xml', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
			if (!validTypes.includes(file.type)) {
				toast.error('请上传SVG、PDF或图片文件')
				return
			}

			// 存储文件到tempFile
			setTempFile(file)
			handlePatternUpdate({
				file, // 仍然设置到colorConfig中，但会被persist排除
				patternName: file.name.replace(/\.[^/.]+$/, '') // 移除文件扩展名
			})
			toast.success('图案文件已上传')
		}
	}

	// 导出功能
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
		resetDesign() // 这会同时清除tempFile
		setColorType('solid')
		toast.success('设计已重置')
	}

	// 处理口袋配置更新
	const handlePocketModeChange = (mode: PocketMode) => {
		const newConfig: PocketConfig = { mode }
		
		// 根据模式设置默认值
		switch (mode) {
			case 'single':
				newConfig.singlePocket = {
					width: 12,
					height: 10,
					positionX: 50,
					positionY: 60
				}
				break
			case 'double':
				newConfig.doublePockets = {
					leftPocket: { width: 10, height: 8 },
					rightPocket: { width: 10, height: 8 },
					spacing: 8,
					positionY: 60
				}
				break
			case 'multiple':
				newConfig.multiplePockets = {
					totalWidth: 30,
					height: 8,
					count: 3,
					positionY: 60
				}
				break
		}
		
		updatePocketConfig(newConfig)
		toast.success('口袋模式已更新')
	}

	const handleSinglePocketUpdate = (updates: Partial<NonNullable<PocketConfig['singlePocket']>>) => {
		if (design.pocketConfig.mode === 'single' && design.pocketConfig.singlePocket) {
			updatePocketConfig({
				...design.pocketConfig,
				singlePocket: { ...design.pocketConfig.singlePocket, ...updates }
			})
		}
	}

	const handleDoublePocketsUpdate = (updates: Partial<NonNullable<PocketConfig['doublePockets']>>) => {
		if (design.pocketConfig.mode === 'double' && design.pocketConfig.doublePockets) {
			updatePocketConfig({
				...design.pocketConfig,
				doublePockets: { ...design.pocketConfig.doublePockets, ...updates }
			})
		}
	}

	const handleMultiplePocketsUpdate = (updates: Partial<NonNullable<PocketConfig['multiplePockets']>>) => {
		if (design.pocketConfig.mode === 'multiple' && design.pocketConfig.multiplePockets) {
			updatePocketConfig({
				...design.pocketConfig,
				multiplePockets: { ...design.pocketConfig.multiplePockets, ...updates }
			})
		}
	}

	// 处理颈带颜色更新
	const handleNeckStrapColorUpdate = (updates: Partial<SolidColorConfig>) => {
		updateNeckStrapColor({
			...design.neckStrapColor,
			...updates
		})
	}

	// 处理口袋颜色更新
	const handlePocketColorUpdate = (updates: Partial<SolidColorConfig>) => {
		updatePocketColor({
			...design.pocketColor,
			...updates
		})
	}

	// 处理LOGO配置更新
	const handleLogoConfigUpdate = (updates: Partial<LogoConfig>) => {
		updateLogoConfig({
			...design.logoConfig,
			...updates
		})
	}

			// 计算LOGO的实际尺寸和位置
	const calculateLogoMetrics = () => {
		const logoConfig = design.logoConfig
		const apronWidth = design.bottomWidth // 使用围裙底部宽度作为参考
		const apronHeight = design.totalHeight // 围裙总高度
		
		// LOGO宽度和高度（根据宽高比计算）
		const logoWidth = logoConfig.width
		const logoHeight = logoConfig.width / logoConfig.aspectRatio // 根据宽高比计算实际高度
		
		// 距离边缘的距离
		const distanceFromLeft = logoConfig.offsetX.toFixed(1)
		const distanceFromTop = logoConfig.offsetY.toFixed(1)
		const distanceFromRight = (apronWidth - logoConfig.offsetX - logoWidth).toFixed(1)
		const distanceFromBottom = (apronHeight - logoConfig.offsetY - logoHeight).toFixed(1)
		
		// 计算居中状态
		const centerX = apronWidth / 2
		const centerY = apronHeight / 2
		const logoOffsetFromCenterX = logoConfig.offsetX + logoWidth / 2 - centerX
		const logoOffsetFromCenterY = logoConfig.offsetY + logoHeight / 2 - centerY
		
		return {
			logoWidth: logoWidth.toFixed(1),
			logoHeight: logoHeight.toFixed(1),
			distanceFromLeft,
			distanceFromTop,
			distanceFromRight,
			distanceFromBottom,
			centerOffset: {
				horizontal: Math.abs(logoOffsetFromCenterX) < 0.5 ? '水平居中' : 
					logoOffsetFromCenterX > 0 ? `右偏 ${logoOffsetFromCenterX.toFixed(1)}CM` : `左偏 ${Math.abs(logoOffsetFromCenterX).toFixed(1)}CM`,
				vertical: Math.abs(logoOffsetFromCenterY) < 0.5 ? '垂直居中' : 
					logoOffsetFromCenterY > 0 ? `下偏 ${logoOffsetFromCenterY.toFixed(1)}CM` : `上偏 ${Math.abs(logoOffsetFromCenterY).toFixed(1)}CM`
			}
		}
	}

	// 处理LOGO文件上传
	const handleLogoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			// 验证文件类型
			const validTypes = ['image/svg+xml', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
			if (!validTypes.includes(file.type)) {
				toast.error('请上传SVG、PDF或图片文件')
				return
			}

			// 存储文件到logoTempFile
			setLogoTempFile(file)
			
			// 获取文件的宽高比
			getFileAspectRatio(file).then(aspectRatio => {
				handleLogoConfigUpdate({
					file, // 仍然设置到logoConfig中，但会被persist排除
					logoName: file.name.replace(/\.[^/.]+$/, ''), // 移除文件扩展名
					aspectRatio: aspectRatio || 1, // 如果无法获取宽高比，默认为1（正方形）
					enabled: true // 自动启用LOGO功能
				})
			})
			
			toast.success('LOGO文件已上传')
		}
	}

	// 获取文件的宽高比
	const getFileAspectRatio = async (file: File): Promise<number> => {
		return new Promise((resolve) => {
			if (file.type.includes('svg')) {
				// 处理SVG文件
				const reader = new FileReader()
				reader.onload = (e) => {
					try {
						const svgContent = e.target?.result as string
						const parser = new DOMParser()
						const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
						const svgElement = svgDoc.documentElement
						
						if (svgElement && svgElement.tagName === 'svg') {
							const viewBox = svgElement.getAttribute('viewBox')
							if (viewBox) {
								const viewBoxParts = viewBox.split(' ').map(Number)
								if (viewBoxParts.length >= 4) {
									const vbWidth = viewBoxParts[2]
									const vbHeight = viewBoxParts[3]
																if (vbWidth && vbHeight) {
								resolve(vbWidth / vbHeight)
								return
							}
								}
							}
							
							// 尝试从width和height属性获取
							const width = Number.parseFloat(svgElement.getAttribute('width') || '0')
							const height = Number.parseFloat(svgElement.getAttribute('height') || '0')
							if (width && height) {
								resolve(width / height)
								return
							}
						}
					} catch (error) {
						console.error('解析SVG失败:', error)
					}
					resolve(1) // 默认正方形
				}
				reader.readAsText(file)
			} else if (file.type.includes('image')) {
				// 处理图片文件
				const img = new Image()
				img.onload = () => {
					resolve(img.width / img.height)
				}
				img.onerror = () => {
					resolve(1) // 默认正方形
				}
				img.src = URL.createObjectURL(file)
			} else {
				// 其他文件类型（如PDF），默认正方形
				resolve(1)
			}
		})
	}

	// 处理鼠标滚轮缩放
	const handleWheelZoom = (e: React.WheelEvent) => {
		e.preventDefault()
		const delta = e.deltaY
		const zoomStep = 0.1
		
		if (delta < 0) {
			// 向上滚动，放大
			handleZoomChange(Math.min(3, previewScale + zoomStep))
		} else {
			// 向下滚动，缩小
			handleZoomChange(Math.max(0.5, previewScale - zoomStep))
		}
	}

	// 处理鼠标按下开始拖拽
	const handleMouseDown = (e: React.MouseEvent) => {
		if (previewScale > 1) { // 只有放大时才允许拖拽
			setIsDragging(true)
			setDragStart({
				x: e.clientX - translatePosition.x,
				y: e.clientY - translatePosition.y
			})
		}
	}

	// 处理鼠标移动拖拽
	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging && previewScale > 1) {
			setTranslatePosition({
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y
			})
		}
	}

	// 处理鼠标松开结束拖拽
	const handleMouseUp = () => {
		setIsDragging(false)
	}

	// 缩放变化时重置拖拽位置
	const handleZoomChange = (newScale: number) => {
		setPreviewScale(newScale)
		if (newScale <= 1) {
			setTranslatePosition({ x: 0, y: 0 }) // 缩放到100%以下时重置位置
		}
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			{/* 左侧：控制面板（可滚动） */}
			<div className="flex-1 p-4 overflow-y-auto max-h-screen">
				<div className="mb-6 text-center">
					<h1 className="text-3xl font-bold text-gray-900">围裙设计稿生成器</h1>
					<p className="mt-2 text-gray-600">专业的围裙设计工具，按照工业标准生成可编辑的设计稿</p>
				</div>

				<div className="space-y-6 max-w-2xl">
					{/* 基础尺寸参数 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Ruler className="h-5 w-5" />
								基础尺寸参数
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="topWidth">围裙上沿宽度 (CM)</Label>
									<Input
										id="topWidth"
										type="number"
										value={design.topWidth}
										onChange={(e) => updateDesign({ topWidth: Number(e.target.value) })}
										min="20"
										max="80"
										step="0.5"
									/>
								</div>
								<div>
									<Label htmlFor="bottomWidth">围裙下沿宽度 (CM)</Label>
									<Input
										id="bottomWidth"
										type="number"
										value={design.bottomWidth}
										onChange={(e) => updateDesign({ bottomWidth: Number(e.target.value) })}
										min="30"
										max="120"
										step="0.5"
									/>
								</div>
							</div>

							<div>
								<Label htmlFor="totalHeight">围裙整体高度 (CM)</Label>
								<Input
									id="totalHeight"
									type="number"
									value={design.totalHeight}
									onChange={(e) => updateDesign({ totalHeight: Number(e.target.value) })}
									min="40"
									max="120"
									step="0.5"
								/>
							</div>

							<Separator />

							{/* 自动计算的尺寸 */}
							<div className="rounded-lg bg-blue-50 p-4">
								<div className="flex items-center gap-2 mb-2">
									<Calculator className="h-4 w-4 text-blue-600" />
									<span className="text-sm font-medium text-blue-900">自动计算尺寸</span>
								</div>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-gray-600">围裙上部高度:</span>
										<span className="ml-2 font-medium">{design.waistHeight} CM</span>
										<span className="text-xs text-gray-400 block">
											({((design.waistHeight / design.totalHeight) * 100).toFixed(1)}%)
										</span>
									</div>
									<div>
										<span className="text-gray-600">围裙下部高度:</span>
										<span className="ml-2 font-medium">{design.bottomHeight} CM</span>
										<span className="text-xs text-gray-400 block">
											({((design.bottomHeight / design.totalHeight) * 100).toFixed(1)}%)
										</span>
									</div>
								</div>
								<p className="text-xs text-gray-500 mt-2">
									* 上部高度 = 整体高度 × 33%，下部高度 = 整体高度 - 上部高度
								</p>
							</div>
						</CardContent>
					</Card>

					{/* 颈带款式选择 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Settings className="h-5 w-5" />
								颈带款式选择
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="neckStrapStyle">选择颈带款式</Label>
								<Select
									value={design.neckStrapStyle}
									onValueChange={(value: NeckStrapStyle) => 
										updateDesign({ neckStrapStyle: value })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.values(NECK_STRAP_STYLES).map((style) => (
											<SelectItem key={style.style} value={style.style}>
												<div className="flex flex-col">
													<span className="font-medium">{style.name}</span>
													<span className="text-xs text-gray-500">{style.description}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* 当前选择的款式预览 */}
							<div className="rounded-lg bg-green-50 p-4">
								<div className="flex items-center gap-2 mb-2">
									<span className="text-sm font-medium text-green-900">当前选择</span>
								</div>
								<div className="text-sm">
									<div className="font-medium text-green-800">
										{NECK_STRAP_STYLES[design.neckStrapStyle]?.name || '经典圆弧'}
									</div>
									<div className="text-green-600 mt-1">
										{NECK_STRAP_STYLES[design.neckStrapStyle]?.description || '传统的圆弧形颈带，简洁优雅'}
									</div>
								</div>
							</div>

							<Separator />

							{/* 颈带长度调节 */}
							<div>
								<Label htmlFor="neckStrap">颈带长度 (CM)</Label>
								<div className="flex items-center gap-2">
									<Input
										id="neckStrap"
										type="range"
										min="30"
										max="80"
										step="2"
										value={design.neckStrap}
										onChange={(e) => updateDesign({ neckStrap: Number(e.target.value) })}
										className="flex-1"
									/>
									<span className="text-sm font-medium w-12 text-center">
										{design.neckStrap}
									</span>
								</div>
							</div>

							{/* 腰带长度调节 */}
							<div>
								<Label htmlFor="waistStrap">腰带长度 (CM)</Label>
								<div className="flex items-center gap-2">
									<Input
										id="waistStrap"
										type="range"
										min="40"
										max="120"
										step="5"
										value={design.waistStrap}
										onChange={(e) => updateDesign({ waistStrap: Number(e.target.value) })}
										className="flex-1"
									/>
									<span className="text-sm font-medium w-12 text-center">
										{design.waistStrap}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* 颜色规格配置 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Palette className="h-5 w-5" />
								颜色规格配置
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Tabs value={colorType} onValueChange={(value) => handleColorTypeChange(value as 'solid' | 'pattern')}>
								<TabsList className="grid w-full grid-cols-2">
									<TabsTrigger value="solid">纯色</TabsTrigger>
									<TabsTrigger value="pattern">印花</TabsTrigger>
								</TabsList>

								<TabsContent value="solid" className="mt-4 space-y-4">
									<div>
										<Label htmlFor="colorName">颜色名称</Label>
										<Input
											id="colorName"
											value={design.colorConfig.type === 'solid' ? design.colorConfig.colorName : ''}
											onChange={(e) => handleSolidColorUpdate({ colorName: e.target.value })}
											placeholder="如：珊瑚红、天蓝色等"
										/>
									</div>

									<div>
										<Label htmlFor="hexValue">预览颜色</Label>
										<div className="flex items-center gap-2">
											<Input
												id="hexValue"
												type="color"
												value={design.colorConfig.type === 'solid' ? design.colorConfig.hexValue : '#FF6B6B'}
												onChange={(e) => handleSolidColorUpdate({ hexValue: e.target.value })}
												className="w-16 h-10 rounded border"
											/>
											<Input
												type="text"
												value={design.colorConfig.type === 'solid' ? design.colorConfig.hexValue : '#FF6B6B'}
												onChange={(e) => handleSolidColorUpdate({ hexValue: e.target.value })}
												placeholder="#FF6B6B"
												className="flex-1"
											/>
										</div>
									</div>
								</TabsContent>

								<TabsContent value="pattern" className="mt-4 space-y-4">
									<div>
										<Label htmlFor="patternName">图案名称</Label>
										<Input
											id="patternName"
											value={design.colorConfig.type === 'pattern' ? design.colorConfig.patternName : ''}
											onChange={(e) => handlePatternUpdate({ patternName: e.target.value })}
											placeholder="如：花卉图案、几何图形等"
										/>
									</div>

									<div>
										<Label htmlFor="patternFile">上传图案文件</Label>
										<div className="flex items-center gap-2">
											<Input
												id="patternFile"
												type="file"
												accept=".svg,.pdf,.png,.jpg,.jpeg"
												onChange={handleFileUpload}
												className="flex-1"
											/>
											<Upload className="h-4 w-4 text-gray-400" />
										</div>
										<p className="text-xs text-gray-500 mt-1">
											支持 SVG、PDF、PNG、JPG 格式
										</p>
										{tempFile && (
											<p className="text-xs text-green-600 mt-1">
												✓ 已上传: {tempFile.name}
											</p>
										)}
									</div>

									{design.colorConfig.type === 'pattern' && (
										<div>
											<Label htmlFor="repeatMode">重复模式</Label>
											<Select
												value={design.colorConfig.repeatMode}
												onValueChange={(value: 'tile' | 'stretch' | 'center' | 'custom') => 
													handlePatternUpdate({ repeatMode: value })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="tile">平铺</SelectItem>
													<SelectItem value="stretch">拉伸</SelectItem>
													<SelectItem value="center">居中</SelectItem>
													<SelectItem value="custom">自定义</SelectItem>
												</SelectContent>
											</Select>
										</div>
									)}
								</TabsContent>
							</Tabs>
						</CardContent>
					</Card>

					{/* 颈带颜色配置 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Palette className="h-5 w-5" />
								颈带颜色
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="neckStrapColorName">颜色名称</Label>
								<Input
									id="neckStrapColorName"
									value={design.neckStrapColor.colorName}
									onChange={(e) => handleNeckStrapColorUpdate({ colorName: e.target.value })}
									placeholder="如：深棕色、黑色等"
								/>
							</div>

							<div>
								<Label htmlFor="neckStrapHexValue">预览颜色</Label>
								<div className="flex items-center gap-2">
									<Input
										id="neckStrapHexValue"
										type="color"
										value={design.neckStrapColor.hexValue}
										onChange={(e) => handleNeckStrapColorUpdate({ hexValue: e.target.value })}
										className="w-16 h-10 rounded border"
									/>
									<Input
										type="text"
										value={design.neckStrapColor.hexValue}
										onChange={(e) => handleNeckStrapColorUpdate({ hexValue: e.target.value })}
										placeholder="#8B4513"
										className="flex-1"
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* 口袋颜色配置 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Palette className="h-5 w-5" />
								口袋颜色
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="pocketColorName">颜色名称</Label>
								<Input
									id="pocketColorName"
									value={design.pocketColor.colorName}
									onChange={(e) => handlePocketColorUpdate({ colorName: e.target.value })}
									placeholder="如：米白色、浅灰色等"
								/>
							</div>

							<div>
								<Label htmlFor="pocketHexValue">预览颜色</Label>
								<div className="flex items-center gap-2">
									<Input
										id="pocketHexValue"
										type="color"
										value={design.pocketColor.hexValue}
										onChange={(e) => handlePocketColorUpdate({ hexValue: e.target.value })}
										className="w-16 h-10 rounded border"
									/>
									<Input
										type="text"
										value={design.pocketColor.hexValue}
										onChange={(e) => handlePocketColorUpdate({ hexValue: e.target.value })}
										placeholder="#F5F5DC"
										className="flex-1"
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* 口袋配置 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								口袋配置
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* 口袋模式选择 */}
							<div>
								<Label>口袋模式</Label>
								<div className="grid grid-cols-2 gap-2 mt-2">
									<Button
										variant={design.pocketConfig.mode === 'none' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handlePocketModeChange('none')}
									>
										无口袋
									</Button>
									<Button
										variant={design.pocketConfig.mode === 'single' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handlePocketModeChange('single')}
									>
										单口袋
									</Button>
									<Button
										variant={design.pocketConfig.mode === 'double' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handlePocketModeChange('double')}
									>
										双口袋
									</Button>
									<Button
										variant={design.pocketConfig.mode === 'multiple' ? 'default' : 'outline'}
										size="sm"
										onClick={() => handlePocketModeChange('multiple')}
									>
										多口袋
									</Button>
								</div>
							</div>

							{/* 根据选择的模式显示相应配置 */}
							{design.pocketConfig.mode === 'single' && design.pocketConfig.singlePocket && (
								<div className="space-y-3">
									<Separator />
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="singleWidth">口袋宽度 (CM)</Label>
											<Input
												id="singleWidth"
												type="number"
												min="5"
												max="30"
												step="0.5"
												value={design.pocketConfig.singlePocket.width}
												onChange={(e) => handleSinglePocketUpdate({ width: Number(e.target.value) })}
											/>
										</div>
										<div>
											<Label htmlFor="singleHeight">口袋高度 (CM)</Label>
											<Input
												id="singleHeight"
												type="number"
												min="5"
												max="25"
												step="0.5"
												value={design.pocketConfig.singlePocket.height}
												onChange={(e) => handleSinglePocketUpdate({ height: Number(e.target.value) })}
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="singleX">水平位置 (CM)</Label>
											<Input
												id="singleX"
												type="number"
												min="0"
												step="0.5"
												value={design.pocketConfig.singlePocket.x}
												onChange={(e) => handleSinglePocketUpdate({ x: Number(e.target.value) })}
											/>
										</div>
										<div>
											<Label htmlFor="singleY">垂直位置 (CM)</Label>
											<Input
												id="singleY"
												type="number"
												min="0"
												step="0.5"
												value={design.pocketConfig.singlePocket.y}
												onChange={(e) => handleSinglePocketUpdate({ y: Number(e.target.value) })}
											/>
										</div>
									</div>
								</div>
							)}

							{design.pocketConfig.mode === 'double' && design.pocketConfig.doublePockets && (
								<div className="space-y-3">
									<Separator />
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="doubleWidth">口袋宽度 (CM)</Label>
											<Input
												id="doubleWidth"
												type="number"
												min="5"
												max="20"
												step="0.5"
												value={design.pocketConfig.doublePockets.width}
												onChange={(e) => handleDoublePocketsUpdate({ width: Number(e.target.value) })}
											/>
										</div>
										<div>
											<Label htmlFor="doubleHeight">口袋高度 (CM)</Label>
											<Input
												id="doubleHeight"
												type="number"
												min="5"
												max="20"
												step="0.5"
												value={design.pocketConfig.doublePockets.height}
												onChange={(e) => handleDoublePocketsUpdate({ height: Number(e.target.value) })}
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="doubleSpacing">口袋间距 (CM)</Label>
											<Input
												id="doubleSpacing"
												type="number"
												min="2"
												max="20"
												step="0.5"
												value={design.pocketConfig.doublePockets.spacing}
												onChange={(e) => handleDoublePocketsUpdate({ spacing: Number(e.target.value) })}
											/>
										</div>
										<div>
											<Label htmlFor="doubleY">垂直位置 (CM)</Label>
											<Input
												id="doubleY"
												type="number"
												min="0"
												step="0.5"
												value={design.pocketConfig.doublePockets.y}
												onChange={(e) => handleDoublePocketsUpdate({ y: Number(e.target.value) })}
											/>
										</div>
									</div>
								</div>
							)}

							{design.pocketConfig.mode === 'multiple' && design.pocketConfig.multiplePockets && (
								<div className="space-y-3">
									<Separator />
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="multipleCount">口袋数量</Label>
											<Input
												id="multipleCount"
												type="number"
												min="3"
												max="6"
												value={design.pocketConfig.multiplePockets.count}
												onChange={(e) => handleMultiplePocketsUpdate({ count: Number(e.target.value) })}
											/>
										</div>
										<div>
											<Label htmlFor="multipleSize">口袋大小 (CM)</Label>
											<Input
												id="multipleSize"
												type="number"
												min="3"
												max="12"
												step="0.5"
												value={design.pocketConfig.multiplePockets.size}
												onChange={(e) => handleMultiplePocketsUpdate({ size: Number(e.target.value) })}
											/>
										</div>
									</div>
									<div>
										<Label htmlFor="multipleSpacing">口袋间距 (CM)</Label>
										<Input
											id="multipleSpacing"
											type="number"
											min="1"
											max="10"
											step="0.5"
											value={design.pocketConfig.multiplePockets.spacing}
											onChange={(e) => handleMultiplePocketsUpdate({ spacing: Number(e.target.value) })}
										/>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* LOGO配置 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								LOGO配置
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{/* LOGO开关 */}
								<div className="flex items-center justify-between">
									<Label htmlFor="logoEnabled">启用LOGO功能</Label>
									<Switch
										id="logoEnabled"
										checked={design.logoConfig.enabled}
										onCheckedChange={(checked) => handleLogoConfigUpdate({ enabled: checked })}
									/>
								</div>

								{design.logoConfig.enabled && (
									<div className="space-y-4">
										{/* LOGO名称 */}
										<div>
											<Label htmlFor="logoName">LOGO名称</Label>
											<Input
												id="logoName"
												value={design.logoConfig.logoName}
												onChange={(e) => handleLogoConfigUpdate({ logoName: e.target.value })}
												placeholder="如：品牌LOGO、店铺标识等"
											/>
										</div>

										{/* LOGO文件上传 */}
										<div>
											<Label htmlFor="logoFile">上传LOGO文件</Label>
											<div className="flex items-center gap-2">
												<Input
													id="logoFile"
													type="file"
													accept=".svg,.pdf,.png,.jpg,.jpeg"
													onChange={handleLogoFileUpload}
													className="flex-1"
												/>
												<Upload className="h-4 w-4 text-gray-400" />
											</div>
											<p className="text-xs text-gray-500 mt-1">
												支持 SVG、PDF、PNG、JPG 格式，建议使用矢量文件
											</p>
											{(logoTempFile || design.logoConfig.file) && (
												<p className="text-xs text-green-600 mt-1">
													✓ 已上传: {logoTempFile?.name || design.logoConfig.file?.name || '文件'}
												</p>
											)}
										</div>

										{/* LOGO尺寸 */}
										<div>
											<Label htmlFor="logoWidth">LOGO宽度 (CM)</Label>
											<Input
												id="logoWidth"
												type="number"
												min="1"
												max="30"
												step="0.5"
												value={design.logoConfig.width}
												onChange={(e) => handleLogoConfigUpdate({ width: Number(e.target.value) })}
												placeholder="8"
											/>
											<p className="text-xs text-gray-500 mt-1">
												高度将根据原始文件比例自动调整 (当前比例: {design.logoConfig.aspectRatio.toFixed(2)}:1)，建议范围：3-15厘米
											</p>
										</div>

										{/* LOGO水平位置 */}
										<div>
											<Label htmlFor="logoOffsetX">水平位置 (CM)</Label>
											<div className="flex gap-2">
												<Input
													id="logoOffsetX"
													type="number"
													min="0"
													max={design.bottomWidth - design.logoConfig.width}
													step="0.5"
													value={design.logoConfig.offsetX}
													onChange={(e) => handleLogoConfigUpdate({ offsetX: Number(e.target.value) })}
													placeholder="15"
													className="flex-1"
												/>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => {
														const centerX = (design.bottomWidth - design.logoConfig.width) / 2
														handleLogoConfigUpdate({ offsetX: Number(centerX.toFixed(1)) })
													}}
													className="whitespace-nowrap"
												>
													水平居中
												</Button>
											</div>
											<p className="text-xs text-gray-500 mt-1">
												距离围裙左边的距离，最大值：{(design.bottomWidth - design.logoConfig.width).toFixed(1)} CM
											</p>
										</div>

										{/* LOGO垂直位置 */}
										<div>
											<Label htmlFor="logoOffsetY">垂直位置 (CM)</Label>
											<Input
												id="logoOffsetY"
												type="number"
												min="0"
												max={design.totalHeight - (design.logoConfig.width / design.logoConfig.aspectRatio)}
												step="0.5"
												value={design.logoConfig.offsetY}
												onChange={(e) => handleLogoConfigUpdate({ offsetY: Number(e.target.value) })}
												placeholder="12"
											/>
											<p className="text-xs text-gray-500 mt-1">
												距离围裙顶部的距离，最大值：{(design.totalHeight - (design.logoConfig.width / design.logoConfig.aspectRatio)).toFixed(1)} CM
											</p>
										</div>

										{/* LOGO透明度 */}
										<div>
											<Label htmlFor="logoOpacity">透明度 (%)</Label>
											<div className="flex items-center gap-2">
												<Input
													id="logoOpacity"
													type="range"
													min="10"
													max="100"
													step="5"
													value={design.logoConfig.opacity}
													onChange={(e) => handleLogoConfigUpdate({ opacity: Number(e.target.value) })}
													className="flex-1"
												/>
												<span className="text-sm font-medium w-12">
													{design.logoConfig.opacity}%
												</span>
											</div>
											<p className="text-xs text-gray-500 mt-1">
												100% = 完全不透明，数值越小越透明
											</p>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* 操作按钮 */}
					<Card>
						<CardHeader>
							<CardTitle>导出设计稿</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4">
								<Button 
									onClick={handleExportSVG} 
									disabled={isExporting}
									className="w-full"
								>
									<FileImage className="mr-2 h-4 w-4" />
									导出 SVG
								</Button>
								<Button 
									onClick={handleExportPNG} 
									disabled={isExporting}
									variant="outline"
									className="w-full"
								>
									<Download className="mr-2 h-4 w-4" />
									导出 PNG
								</Button>
							</div>
							<Button 
								onClick={handleExportPackage} 
								disabled={isExporting}
								variant="secondary"
								className="w-full mt-2"
							>
								<Package className="mr-2 h-4 w-4" />
								导出完整设计包
							</Button>
							<Separator className="my-4" />
							<Button 
								onClick={handleReset} 
								variant="destructive"
								className="w-full"
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								重置设计
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* 右侧：SVG预览 */}
			<div className="w-1/2 min-w-[500px] p-4 border-l bg-white">
				<Card className="h-full">
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							设计稿预览
							<div className="flex items-center gap-2">
															<Button
								variant="outline"
								size="sm"
								onClick={() => handleZoomChange(Math.max(0.5, previewScale - 0.1))}
								disabled={previewScale <= 0.5}
							>
								<ZoomOut className="h-4 w-4" />
							</Button>
							<span className="text-sm font-mono w-12 text-center">
								{Math.round(previewScale * 100)}%
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleZoomChange(Math.min(3, previewScale + 0.1))}
								disabled={previewScale >= 3}
							>
								<ZoomIn className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleZoomChange(1)}
							>
								<RotateCcw className="h-4 w-4" />
							</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent className="h-full">
						<div 
							className={`border rounded-lg bg-gray-50 h-full flex items-center justify-center overflow-hidden ${
								previewScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
							}`}
							onWheel={handleWheelZoom}
							onMouseDown={handleMouseDown}
							onMouseMove={handleMouseMove}
							onMouseUp={handleMouseUp}
							onMouseLeave={handleMouseUp}
						>
							{svgContent ? (
								<div 
									style={{
										transform: `scale(${previewScale}) translate(${translatePosition.x}px, ${translatePosition.y}px)`,
										transformOrigin: 'center center',
										transition: isDragging ? 'none' : 'transform 0.2s ease-in-out'
									}}
									className="p-4 select-none"
								>
									<div dangerouslySetInnerHTML={{ __html: svgContent }} />
								</div>
							) : (
								<div className="text-center text-gray-500">
									<Palette className="mx-auto h-12 w-12 mb-4 opacity-50" />
									<p>设计稿生成中...</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

