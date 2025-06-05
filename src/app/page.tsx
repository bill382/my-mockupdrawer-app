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
import type { SolidColorConfig, PatternConfig, NeckStrapStyle, PocketConfig, PocketMode } from '@/store/apron-design'
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
	Settings
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * @description 这只是个示例页面，你可以随意修改这个页面或进行全面重构
 */
export default function ApronDesignGenerator() {
	const { design, updateDesign, updateColorConfig, updatePocketConfig, resetDesign, tempFile, setTempFile } = useApronDesignStore()
	const [svgContent, setSvgContent] = useState('')
	const [isExporting, setIsExporting] = useState(false)
	const [colorType, setColorType] = useState<'solid' | 'pattern'>(design.colorConfig.type)

	// 生成SVG预览
	const generatePreview = async () => {
		// 只在客户端生成SVG
		if (typeof window === 'undefined') {
			return ''
		}
		
		try {
			const generator = new ApronSVGGenerator(design, tempFile)
			return await generator.generate()
		} catch (error) {
			console.error('SVG生成失败:', error)
			return ''
		}
	}

	useEffect(() => {
		generatePreview().then(setSvgContent)
	}, [design, tempFile])

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

	return (
		<div className="min-h-screen bg-gray-50 p-4">
			<div className="mx-auto max-w-7xl">
				<div className="mb-6 text-center">
					<h1 className="text-3xl font-bold text-gray-900">围裙设计稿生成器</h1>
					<p className="mt-2 text-gray-600">专业的围裙设计工具，按照工业标准生成可编辑的设计稿</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					{/* 左侧：设计表单 */}
					<div className="space-y-6">
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
										<TabsTrigger value="solid">纯色围裙</TabsTrigger>
										<TabsTrigger value="pattern">印花围裙</TabsTrigger>
									</TabsList>
									
									<TabsContent value="solid" className="space-y-4">
										<div>
											<Label htmlFor="colorName">颜色名称</Label>
											<Input
												id="colorName"
												value={design.colorConfig.type === 'solid' ? design.colorConfig.colorName : ''}
												onChange={(e) => handleSolidColorUpdate({ colorName: e.target.value })}
												placeholder="例如：珊瑚红、天蓝色"
											/>
										</div>
										
										<div>
											<Label htmlFor="pantoneCode">潘通色号 (可选)</Label>
											<Input
												id="pantoneCode"
												value={design.colorConfig.type === 'solid' ? design.colorConfig.pantoneCode || '' : ''}
												onChange={(e) => handleSolidColorUpdate({ pantoneCode: e.target.value })}
												placeholder="例如：PANTONE 18-1664 TPX"
											/>
										</div>
										
										<div>
											<Label htmlFor="hexValue">预览颜色</Label>
											<div className="flex gap-2">
												<Input
													id="hexValue"
													type="color"
													value={design.colorConfig.type === 'solid' ? design.colorConfig.hexValue : '#FF6B6B'}
													onChange={(e) => handleSolidColorUpdate({ hexValue: e.target.value })}
													className="w-16 h-10 p-1"
												/>
												<Input
													value={design.colorConfig.type === 'solid' ? design.colorConfig.hexValue : '#FF6B6B'}
													onChange={(e) => handleSolidColorUpdate({ hexValue: e.target.value })}
													placeholder="#FF6B6B"
													className="flex-1"
												/>
											</div>
										</div>
									</TabsContent>
									
									<TabsContent value="pattern" className="space-y-4">
										<div>
											<Label htmlFor="patternName">图案名称</Label>
											<Input
												id="patternName"
												value={design.colorConfig.type === 'pattern' ? design.colorConfig.patternName : ''}
												onChange={(e) => handlePatternUpdate({ patternName: e.target.value })}
												placeholder="例如：花卉图案、几何纹理"
											/>
										</div>
										
										<div>
											<Label htmlFor="patternFile">上传矢量图案文件</Label>
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
										</div>
										
										<div>
											<Label htmlFor="repeatMode">图案重复模式</Label>
											<Select
												value={design.colorConfig.type === 'pattern' ? design.colorConfig.repeatMode : 'tile'}
												onValueChange={(value: 'tile' | 'stretch' | 'center' | 'custom') => 
													handlePatternUpdate({ repeatMode: value })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="tile">平铺重复</SelectItem>
													<SelectItem value="stretch">拉伸填充</SelectItem>
													<SelectItem value="center">居中显示</SelectItem>
													<SelectItem value="custom">自定义位置和大小</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{/* 自定义模式的控制面板 */}
										{design.colorConfig.type === 'pattern' && design.colorConfig.repeatMode === 'custom' && (
											<div className="space-y-4 p-4 bg-blue-50 rounded-lg">
												<div className="flex items-center gap-2 mb-2">
													<Settings className="h-4 w-4 text-blue-600" />
													<span className="text-sm font-medium text-blue-900">自定义图案设置</span>
												</div>
												
												<div>
													<Label htmlFor="customSize">图案大小 (%)</Label>
													<div className="flex items-center gap-2">
														<Input
															id="customSize"
															type="range"
															min="10"
															max="100"
															step="5"
															value={design.colorConfig.customSize || 30}
															onChange={(e) => handlePatternUpdate({ customSize: Number(e.target.value) })}
															className="flex-1"
														/>
														<span className="text-sm font-medium w-12">
															{design.colorConfig.customSize || 30}%
														</span>
													</div>
													<p className="text-xs text-gray-500 mt-1">
														图案相对于围裙区域的大小
													</p>
												</div>
												
												<div>
													<Label htmlFor="customPositionX">水平位置 (%)</Label>
													<div className="flex items-center gap-2">
														<Input
															id="customPositionX"
															type="range"
															min="0"
															max="100"
															step="5"
															value={design.colorConfig.customPositionX || 50}
															onChange={(e) => handlePatternUpdate({ customPositionX: Number(e.target.value) })}
															className="flex-1"
														/>
														<span className="text-sm font-medium w-12">
															{design.colorConfig.customPositionX || 50}%
														</span>
													</div>
													<p className="text-xs text-gray-500 mt-1">
														0% = 左边，50% = 居中，100% = 右边
													</p>
												</div>
												
												<div>
													<Label htmlFor="customPositionY">垂直位置 (%)</Label>
													<div className="flex items-center gap-2">
														<Input
															id="customPositionY"
															type="range"
															min="0"
															max="100"
															step="5"
															value={design.colorConfig.customPositionY || 50}
															onChange={(e) => handlePatternUpdate({ customPositionY: Number(e.target.value) })}
															className="flex-1"
														/>
														<span className="text-sm font-medium w-12">
															{design.colorConfig.customPositionY || 50}%
														</span>
													</div>
													<p className="text-xs text-gray-500 mt-1">
														0% = 顶部，50% = 居中，100% = 底部
													</p>
												</div>
											</div>
										)}
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>

						{/* 口袋配置 */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Package className="h-5 w-5" />
									口袋配置
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div>
										<Label htmlFor="pocketMode">选择口袋模式</Label>
										<Select
											value={design.pocketConfig.mode}
											onValueChange={(value: PocketMode) => handlePocketModeChange(value)}
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

									{/* 单口袋配置 */}
									{design.pocketConfig.mode === 'single' && design.pocketConfig.singlePocket && (
										<div className="space-y-4 p-4 bg-blue-50 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Package className="h-4 w-4 text-blue-600" />
												<span className="text-sm font-medium text-blue-900">单口袋设置</span>
											</div>
											
											<div className="grid grid-cols-2 gap-4">
												<div>
													<Label htmlFor="singlePocketWidth">口袋宽度 (CM)</Label>
													<Input
														id="singlePocketWidth"
														type="number"
														value={design.pocketConfig.singlePocket.width}
														onChange={(e) => handleSinglePocketUpdate({ width: Number(e.target.value) })}
														min="5"
														max="30"
														step="0.5"
													/>
												</div>
												<div>
													<Label htmlFor="singlePocketHeight">口袋高度 (CM)</Label>
													<Input
														id="singlePocketHeight"
														type="number"
														value={design.pocketConfig.singlePocket.height}
														onChange={(e) => handleSinglePocketUpdate({ height: Number(e.target.value) })}
														min="3"
														max="20"
														step="0.5"
													/>
												</div>
											</div>
											
											<div>
												<Label htmlFor="singlePocketX">水平位置 (%)</Label>
												<div className="flex items-center gap-2">
													<Input
														id="singlePocketX"
														type="range"
														min="10"
														max="90"
														step="5"
														value={design.pocketConfig.singlePocket.positionX}
														onChange={(e) => handleSinglePocketUpdate({ positionX: Number(e.target.value) })}
														className="flex-1"
													/>
													<span className="text-sm font-medium w-12">
														{design.pocketConfig.singlePocket.positionX}%
													</span>
												</div>
											</div>
											
											<div>
												<Label htmlFor="singlePocketY">垂直位置 (%)</Label>
												<div className="flex items-center gap-2">
													<Input
														id="singlePocketY"
														type="range"
														min="30"
														max="80"
														step="5"
														value={design.pocketConfig.singlePocket.positionY}
														onChange={(e) => handleSinglePocketUpdate({ positionY: Number(e.target.value) })}
														className="flex-1"
													/>
													<span className="text-sm font-medium w-12">
														{design.pocketConfig.singlePocket.positionY}%
													</span>
												</div>
											</div>
										</div>
									)}

									{/* 双口袋配置 */}
									{design.pocketConfig.mode === 'double' && design.pocketConfig.doublePockets && (
										<div className="space-y-4 p-4 bg-green-50 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Package className="h-4 w-4 text-green-600" />
												<span className="text-sm font-medium text-green-900">双口袋设置</span>
											</div>
											
											<div className="grid grid-cols-2 gap-4">
												<div className="space-y-3">
													<h4 className="text-sm font-medium text-green-800">左口袋</h4>
													<div>
														<Label htmlFor="leftPocketWidth">宽度 (CM)</Label>
														<Input
															id="leftPocketWidth"
															type="number"
															value={design.pocketConfig.doublePockets.leftPocket.width}
															onChange={(e) => handleDoublePocketsUpdate({ 
																leftPocket: { 
																	...design.pocketConfig.doublePockets!.leftPocket, 
																	width: Number(e.target.value) 
																} 
															})}
															min="5"
															max="25"
															step="0.5"
														/>
													</div>
													<div>
														<Label htmlFor="leftPocketHeight">高度 (CM)</Label>
														<Input
															id="leftPocketHeight"
															type="number"
															value={design.pocketConfig.doublePockets.leftPocket.height}
															onChange={(e) => handleDoublePocketsUpdate({ 
																leftPocket: { 
																	...design.pocketConfig.doublePockets!.leftPocket, 
																	height: Number(e.target.value) 
																} 
															})}
															min="3"
															max="20"
															step="0.5"
														/>
													</div>
												</div>
												
												<div className="space-y-3">
													<h4 className="text-sm font-medium text-green-800">右口袋</h4>
													<div>
														<Label htmlFor="rightPocketWidth">宽度 (CM)</Label>
														<Input
															id="rightPocketWidth"
															type="number"
															value={design.pocketConfig.doublePockets.rightPocket.width}
															onChange={(e) => handleDoublePocketsUpdate({ 
																rightPocket: { 
																	...design.pocketConfig.doublePockets!.rightPocket, 
																	width: Number(e.target.value) 
																} 
															})}
															min="5"
															max="25"
															step="0.5"
														/>
													</div>
													<div>
														<Label htmlFor="rightPocketHeight">高度 (CM)</Label>
														<Input
															id="rightPocketHeight"
															type="number"
															value={design.pocketConfig.doublePockets.rightPocket.height}
															onChange={(e) => handleDoublePocketsUpdate({ 
																rightPocket: { 
																	...design.pocketConfig.doublePockets!.rightPocket, 
																	height: Number(e.target.value) 
																} 
															})}
															min="3"
															max="20"
															step="0.5"
														/>
													</div>
												</div>
											</div>
											
											<div>
												<Label htmlFor="pocketSpacing">口袋间距 (CM)</Label>
												<Input
													id="pocketSpacing"
													type="number"
													value={design.pocketConfig.doublePockets.spacing}
													onChange={(e) => handleDoublePocketsUpdate({ spacing: Number(e.target.value) })}
													min="2"
													max="20"
													step="0.5"
												/>
											</div>
											
											<div>
												<Label htmlFor="doublePocketY">垂直位置 (%)</Label>
												<div className="flex items-center gap-2">
													<Input
														id="doublePocketY"
														type="range"
														min="30"
														max="80"
														step="5"
														value={design.pocketConfig.doublePockets.positionY}
														onChange={(e) => handleDoublePocketsUpdate({ positionY: Number(e.target.value) })}
														className="flex-1"
													/>
													<span className="text-sm font-medium w-12">
														{design.pocketConfig.doublePockets.positionY}%
													</span>
												</div>
											</div>
										</div>
									)}

									{/* 多口袋配置 */}
									{design.pocketConfig.mode === 'multiple' && design.pocketConfig.multiplePockets && (
										<div className="space-y-4 p-4 bg-purple-50 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Package className="h-4 w-4 text-purple-600" />
												<span className="text-sm font-medium text-purple-900">多口袋设置</span>
											</div>
											
											<div className="grid grid-cols-2 gap-4">
												<div>
													<Label htmlFor="totalPocketWidth">总宽度 (CM)</Label>
													<Input
														id="totalPocketWidth"
														type="number"
														value={design.pocketConfig.multiplePockets.totalWidth}
														onChange={(e) => handleMultiplePocketsUpdate({ totalWidth: Number(e.target.value) })}
														min="15"
														max="50"
														step="1"
													/>
													<p className="text-xs text-gray-500 mt-1">
														所有口袋加起来的总宽度
													</p>
												</div>
												<div>
													<Label htmlFor="multiplePocketHeight">口袋高度 (CM)</Label>
													<Input
														id="multiplePocketHeight"
														type="number"
														value={design.pocketConfig.multiplePockets.height}
														onChange={(e) => handleMultiplePocketsUpdate({ height: Number(e.target.value) })}
														min="3"
														max="15"
														step="0.5"
													/>
													<p className="text-xs text-gray-500 mt-1">
														所有口袋统一高度
													</p>
												</div>
											</div>
											
											<div>
												<Label htmlFor="pocketCount">口袋数量</Label>
												<Select
													value={design.pocketConfig.multiplePockets.count.toString()}
													onValueChange={(value) => handleMultiplePocketsUpdate({ count: Number(value) })}
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
												<Label htmlFor="multiplePocketY">垂直位置 (%)</Label>
												<div className="flex items-center gap-2">
													<Input
														id="multiplePocketY"
														type="range"
														min="30"
														max="80"
														step="5"
														value={design.pocketConfig.multiplePockets.positionY}
														onChange={(e) => handleMultiplePocketsUpdate({ positionY: Number(e.target.value) })}
														className="flex-1"
													/>
													<span className="text-sm font-medium w-12">
														{design.pocketConfig.multiplePockets.positionY}%
													</span>
												</div>
											</div>
											
											{/* 计算显示 */}
											<div className="rounded-lg bg-purple-100 p-3">
												<div className="text-sm">
													<div className="font-medium text-purple-800 mb-1">自动计算</div>
													<div className="text-purple-700">
														每个口袋宽度: {(design.pocketConfig.multiplePockets.totalWidth / design.pocketConfig.multiplePockets.count).toFixed(1)} CM
													</div>
													<div className="text-xs text-purple-600 mt-1">
														总宽度 ÷ 口袋数量 = 单个口袋宽度
													</div>
												</div>
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

					{/* 右侧：SVG预览 */}
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>设计稿预览</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="border rounded-lg bg-white p-4 min-h-[600px] flex items-center justify-center">
									{svgContent ? (
										<div 
											dangerouslySetInnerHTML={{ __html: svgContent }}
											className="max-w-full max-h-full overflow-auto"
										/>
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
			</div>
		</div>
	)
}

