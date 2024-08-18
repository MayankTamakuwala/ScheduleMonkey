import { useState, useEffect, useCallback, useRef } from "react";

export const useWebSocket = (url: string) => {
	const [lastMessage, setLastMessage] = useState<string | Blob | null>(null);
	const [connectionStatus, setConnectionStatus] =
		useState<string>("Disconnected");
	const webSocketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		webSocketRef.current = new WebSocket(url);

		webSocketRef.current.onopen = () => {
			setConnectionStatus("Connected");
		};

		webSocketRef.current.onmessage = (event) => {
			setLastMessage(event.data);
		};

		webSocketRef.current.onerror = () => {
			setConnectionStatus("Error");
		};

		webSocketRef.current.onclose = () => {
			setConnectionStatus("Disconnected");
		};

		return () => {
			if (webSocketRef.current) {
				webSocketRef.current.close();
			}
		};
	}, [url]);

	const sendMessage = useCallback((message: string) => {
		if (
			webSocketRef.current &&
			webSocketRef.current.readyState === WebSocket.OPEN
		) {
			webSocketRef.current.send(message);
		} else {
			console.error("WebSocket is not connected");
		}
	}, []);

	return { lastMessage, connectionStatus, sendMessage };
};
