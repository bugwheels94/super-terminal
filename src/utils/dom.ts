export function hasSomeParentTheClass(element: HTMLElement | null, classname: string): boolean {
	if (!element) return false;
	if (element.className.split(' ').indexOf(classname) >= 0) return true;
	return element.parentNode ? hasSomeParentTheClass(element.parentElement, classname) : false;
}
