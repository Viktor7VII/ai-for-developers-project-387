package com.hexlet.backend.common;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * In the single-container deployment the built frontend is served from static resources.
 * Client-side routes are forwarded to index.html so that a page reload or a shared link works.
 */
@Controller
public class SpaForwardingController {

	@GetMapping({"/", "/admin", "/admin/**", "/book/**"})
	public String index() {
		return "forward:/index.html";
	}
}
