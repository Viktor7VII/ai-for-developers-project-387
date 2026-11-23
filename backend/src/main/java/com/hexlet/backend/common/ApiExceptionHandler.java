package com.hexlet.backend.common;

import com.hexlet.backend.api.model.ErrorResponse;

import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

/**
 * Maps exceptions to the {@code ErrorResponse} format defined in the API contract.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(NotFoundException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public ErrorResponse handleNotFound(NotFoundException e) {
		return new ErrorResponse(e.getMessage());
	}

	@ExceptionHandler(BadRequestException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public ErrorResponse handleBadRequest(BadRequestException e) {
		return new ErrorResponse(e.getMessage());
	}

	@ExceptionHandler(ConflictException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public ErrorResponse handleConflict(ConflictException e) {
		return new ErrorResponse(e.getMessage());
	}

	// Safety net for races on unique constraints (e.g. two concurrent requests with the same slug).
	@ExceptionHandler(DataIntegrityViolationException.class)
	@ResponseStatus(HttpStatus.CONFLICT)
	public ErrorResponse handleDataIntegrity(DataIntegrityViolationException e) {
		return new ErrorResponse("Request conflicts with existing data");
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public ErrorResponse handleValidation(MethodArgumentNotValidException e) {
		String message = e.getBindingResult().getFieldErrors().stream()
				.map(error -> error.getField() + ": " + error.getDefaultMessage())
				.sorted()
				.collect(Collectors.joining("; "));
		return new ErrorResponse(message.isEmpty() ? "Validation failed" : message);
	}

	// Constraint violations on parameters of the generated @Validated API interfaces.
	@ExceptionHandler(HandlerMethodValidationException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public ErrorResponse handleMethodValidation(HandlerMethodValidationException e) {
		String message = e.getAllErrors().stream()
				.map(error -> error.getDefaultMessage())
				.sorted()
				.collect(Collectors.joining("; "));
		return new ErrorResponse(message.isEmpty() ? "Validation failed" : message);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public ErrorResponse handleUnreadable(HttpMessageNotReadableException e) {
		return new ErrorResponse("Malformed request body");
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public ErrorResponse handleMissingParameter(MissingServletRequestParameterException e) {
		return new ErrorResponse("Missing required parameter '" + e.getParameterName() + "'");
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public ErrorResponse handleTypeMismatch(MethodArgumentTypeMismatchException e) {
		return new ErrorResponse("Invalid value for parameter '" + e.getName() + "'");
	}
}
