import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockContext = (): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [JwtAuthGuard, { provide: Reflector, useValue: reflector }],
    }).compile();
    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('retourne true immédiatement si la route est @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const result = await guard.canActivate(mockContext());
    expect(result).toBe(true);
  });

  it("délègue au guard Passport JWT si la route n'est pas @Public()", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    // On mock le prototype de la classe parente (AuthGuard('jwt'))
    const superProto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    const superSpy = jest
      .spyOn(superProto, 'canActivate')
      .mockResolvedValue(true);
    const result = await guard.canActivate(mockContext());
    expect(superSpy).toHaveBeenCalled();
    expect(result).toBe(true);
    superSpy.mockRestore();
  });
});
