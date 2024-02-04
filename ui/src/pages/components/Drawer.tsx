import React, { useRef } from 'react';
import './Drawer.css';
import { FaTimes } from 'react-icons/fa';
interface NativeDialogProps {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	title: string;
}

export const Drawer: React.FC<NativeDialogProps> = ({ open, onClose, children, title }) => {
	const dialogRef = useRef<HTMLDialogElement>(null);

	const handleClose = () => {
		if (dialogRef.current) {
			dialogRef.current.close();
		}
		onClose();
	};

	if (!open) return null;
	return (
		<dialog ref={dialogRef} open={open} className="drawer">
			<h4 className="dialog-title">{title}</h4>
			<button className="dialog-close" onClick={handleClose}>
				<FaTimes />
			</button>
			{children}
		</dialog>
	);
};

export default Drawer;
