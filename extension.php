<?php

class TableOfContentsExtension extends Minz_Extension {
	public function init(): void {
		Minz_View::appendStyle($this->getFileUrl('toc.css', 'css'));
		Minz_View::appendScript($this->getFileUrl('toc.js', 'js'));
	}
}
