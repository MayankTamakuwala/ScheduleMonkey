import { useState, useRef, useCallback, useEffect } from "react";

export const useAudioPlayback = () => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [audioDebugInfo, setAudioDebugInfo] = useState<string>("");
	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
	const audioBufferRef = useRef<AudioBuffer | null>(null);

	const addDebugInfo = (info: string) => {
		setAudioDebugInfo(
			(prev) => `${prev}\n${new Date().toISOString()}: ${info}`
		);
		console.log(info);
	};

	useEffect(() => {
		audioContextRef.current = new (window.AudioContext ||
			(window as any).webkitAudioContext)();
		return () => {
			audioContextRef.current?.close();
		};
	}, []);

	const playAudio = useCallback(async (blob: Blob) => {
		addDebugInfo(
			`Received audio Blob. Size: ${blob.size} bytes, Type: ${
				blob.type || "not specified"
			}`
		);

		if (!audioContextRef.current) {
			addDebugInfo("AudioContext not initialized");
			return;
		}

		try {
			const arrayBuffer = await blob.arrayBuffer();
			audioBufferRef.current = await audioContextRef.current.decodeAudioData(
				arrayBuffer
			);

			if (sourceNodeRef.current) {
				sourceNodeRef.current.stop();
				sourceNodeRef.current.disconnect();
			}

			sourceNodeRef.current = audioContextRef.current.createBufferSource();
			sourceNodeRef.current.buffer = audioBufferRef.current;
			sourceNodeRef.current.connect(audioContextRef.current.destination);

			sourceNodeRef.current.start(0);
			setIsPlaying(true);
			addDebugInfo("Audio playback started");

			sourceNodeRef.current.onended = () => {
				setIsPlaying(false);
				addDebugInfo("Audio playback ended");
			};
		} catch (error) {
			addDebugInfo(`Error playing audio: ${error}`);
		}
	}, []);

	const stopAudio = useCallback(() => {
		if (sourceNodeRef.current) {
			sourceNodeRef.current.stop();
			sourceNodeRef.current.disconnect();
			setIsPlaying(false);
			addDebugInfo("Audio playback stopped");
		}
	}, []);

	const handleVolumeChange = useCallback((volume: number) => {
		if (audioContextRef.current) {
			const gainNode = audioContextRef.current.createGain();
			gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
			if (sourceNodeRef.current) {
				sourceNodeRef.current.disconnect();
				sourceNodeRef.current.connect(gainNode);
				gainNode.connect(audioContextRef.current.destination);
			}
			addDebugInfo(`Volume set to: ${volume}`);
		}
	}, []);

	return {
		isPlaying,
		playAudio,
		stopAudio,
		audioDebugInfo,
		handleVolumeChange,
	};
};
