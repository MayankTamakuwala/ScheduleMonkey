// File: hooks/useAudioPlayback.ts

import { useState, useRef, useCallback } from "react";

export const useAudioPlayback = () => {
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [audioDebugInfo, setAudioDebugInfo] = useState<string>("");
	const audioRef = useRef<HTMLAudioElement>(null);

	const playAudio = useCallback((blob: Blob) => {
		setAudioBlob(blob);
		const audioUrl = URL.createObjectURL(blob);
		setAudioDebugInfo(
			`Received audio Blob. Size: ${blob.size} bytes, Type: ${
				blob.type || "not specified"
			}`
		);

		if (audioRef.current) {
			audioRef.current.src = audioUrl;
			audioRef.current.onloadedmetadata = () => {
				setAudioDebugInfo(
					(prev) =>
						`${prev}\nAudio duration: ${audioRef.current?.duration.toFixed(
							2
						)} seconds`
				);
			};
			audioRef.current
				.play()
				.then(() => {
					setIsPlaying(true);
					setAudioDebugInfo((prev) => `${prev}\nAudio playback started`);
				})
				.catch((e) => {
					console.error("Error playing audio:", e);
					setAudioDebugInfo(
						(prev) => `${prev}\nError playing audio: ${e.message}`
					);
					// Attempt to play using Web Audio API
					playAudioWithWebAudio(blob);
				});
		} else {
			setAudioDebugInfo((prev) => `${prev}\nAudio element not found`);
		}
	}, []);

	const playAudioWithWebAudio = useCallback((blob: Blob) => {
		const audioContext = new (window.AudioContext ||
			(window as any).webkitAudioContext)();
		const fileReader = new FileReader();

		fileReader.onload = async (e) => {
			try {
				const arrayBuffer = e.target?.result as ArrayBuffer;
				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
				const source = audioContext.createBufferSource();
				source.buffer = audioBuffer;
				source.connect(audioContext.destination);
				source.start(0);
				setIsPlaying(true);
				setAudioDebugInfo(
					(prev) => `${prev}\nAudio playback started with Web Audio API`
				);
				source.onended = () => {
					setIsPlaying(false);
					setAudioDebugInfo((prev) => `${prev}\nAudio playback ended`);
				};
			} catch (error) {
				console.error("Error playing audio with Web Audio API:", error);
				setAudioDebugInfo(
					(prev) => `${prev}\nError playing audio with Web Audio API: ${error}`
				);
			}
		};

		fileReader.onerror = (error) => {
			console.error("Error reading file:", error);
			setAudioDebugInfo((prev) => `${prev}\nError reading file: ${error}`);
		};

		fileReader.readAsArrayBuffer(blob);
	}, []);

	const handleVolumeChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const volume = parseFloat(e.target.value);
			if (audioRef.current) {
				audioRef.current.volume = volume;
				setAudioDebugInfo((prev) => `${prev}\nVolume set to: ${volume}`);
			}
		},
		[]
	);

	return {
		audioBlob,
		isPlaying,
		playAudio,
		audioDebugInfo,
		audioRef,
		handleVolumeChange,
	};
};
