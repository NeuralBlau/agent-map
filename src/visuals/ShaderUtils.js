import themeManager from './ThemeManager.js';

/**
 * ShaderUtils - Helper for standardized Three.js shader injections.
 * Prevents redundancy and syntax errors in onBeforeCompile blocks.
 */
export const ShaderUtils = {
  /**
   * Injects a uniform declaration and links its value.
   */
  injectUniform(shader, name, type, sourceUniform) {
    shader.uniforms[name] = sourceUniform;
    
    const decl = `uniform ${type} ${name};`;
    
    // Inject into Vertex Shader if present in onBeforeCompile but not in source
    if (!shader.vertexShader.includes(decl)) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${decl}`
      );
    }

    // Inject into Fragment Shader
    if (!shader.fragmentShader.includes(decl)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\n${decl}`
      );
    }
  },

  /**
   * Injects vertex shader logic (e.g., Wind).
   */
  injectVertexLogic(shader, target, logic) {
    if (!shader.vertexShader.includes(logic)) {
      shader.vertexShader = shader.vertexShader.replace(target, `${target}\n${logic}`);
    }
  },

  /**
   * Injects fragment shader logic (e.g., Theme Color, Noise).
   */
  injectFragmentLogic(shader, target, logic) {
    if (!shader.fragmentShader.includes(logic)) {
      shader.fragmentShader = shader.fragmentShader.replace(target, `${target}\n${logic}`);
    }
  },

  /**
   * Standard "Vibrant Pop" effect for foliage.
   */
  applyFoliagePop(shader, uniformName) {
    this.injectFragmentLogic(shader, '#include <color_fragment>', `
      // Theme Reactivity + 15% Self-Emissive Pop
      diffuseColor.rgb = ${uniformName};
      diffuseColor.rgb += ${uniformName} * 0.15;
    `);
  },

  /**
   * Specialized "Agent Color" logic for multi-colored agents.
   */
  applyAgentColors(shader, index) {
    this.injectUniform(shader, 'uAgentA', 'vec3', themeManager.uniforms.uAgentA);
    this.injectUniform(shader, 'uAgentB', 'vec3', themeManager.uniforms.uAgentB);

    this.injectFragmentLogic(shader, '#include <color_fragment>', `
      diffuseColor.rgb = ${index === 0 ? 'uAgentA' : 'uAgentB'};
    `);
  },

  /**
   * Specialized "Mountain Gradient" logic for peak coloring.
   */
  applyMountainGradients(shader) {
    this.injectUniform(shader, 'uMountainColor', 'vec3', themeManager.uniforms.uMountainColor);
    
    this.injectVertexLogic(shader, '#include <common>', 'attribute float aHeightRatio; varying float vHeightRatio;');
    this.injectVertexLogic(shader, '#include <begin_vertex>', 'vHeightRatio = aHeightRatio;');
    
    this.injectFragmentLogic(shader, '#include <common>', 'varying float vHeightRatio;');
    this.injectFragmentLogic(shader, '#include <color_fragment>', `
        vec3 peakColor = mix(uMountainColor, vec3(1.0), 0.2); 
        diffuseColor.rgb = mix(uMountainColor, peakColor, pow(vHeightRatio, 2.0));
    `);
  },

  /**
   * Standard "Ground Noise" for surface variation.
   */
  applyGroundNoise(shader, uniformName) {
    this.injectFragmentLogic(shader, '#include <common>', `
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
    `);

    this.injectFragmentLogic(shader, '#include <color_fragment>', `
      float n = noise(vUv * 50.0);
      diffuseColor.rgb = ${uniformName} * (0.85 + n * 0.25);
    `);
  },

  /**
   * Standard "Wind" effect for instanced foliage.
   */
  applyWind(shader, timeUniformName) {
    this.injectVertexLogic(shader, '#include <begin_vertex>', `
      float wave = sin(${timeUniformName} * 2.0 + position.x * 2.0 + position.z * 2.0) * 0.3;
      if (position.y > 0.0) { transformed.x += wave; transformed.z += wave * 0.5; }
    `);
  }
};
