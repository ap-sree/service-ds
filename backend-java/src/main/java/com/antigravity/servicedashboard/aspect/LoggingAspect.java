package com.antigravity.servicedashboard.aspect;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Aspect
@Component
public class LoggingAspect {

    private final Logger log = LoggerFactory.getLogger(this.getClass());

    
    @Pointcut("within(com.antigravity.servicedashboard.controller..*)")
    public void controllerPackage() {
    }

    
    @Pointcut("within(com.antigravity.servicedashboard.service..*)")
    public void servicePackage() {
    }

    
    @Around("controllerPackage() || servicePackage()")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        String className = joinPoint.getSignature().getDeclaringTypeName();
        String methodName = joinPoint.getSignature().getName();

        
        
        log.info("Enter: {}.{}() with argument[s] = {}", className, methodName,
                joinPoint.getArgs() == null ? null : Arrays.toString(joinPoint.getArgs()));

        try {
            Object result = joinPoint.proceed();

            long elapsedTime = System.currentTimeMillis() - start;
            
            log.info("Exit: {}.{}() executed in {} ms", className, methodName, elapsedTime);

            return result;
        } catch (IllegalArgumentException e) {
            log.error("Illegal Argument: {} in {}.{}()", Arrays.toString(joinPoint.getArgs()), className, methodName);
            throw e;
        }
    }
}
